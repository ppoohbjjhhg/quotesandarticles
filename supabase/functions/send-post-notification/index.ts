const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const encoder = new TextEncoder();
const encodeBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
const decodeBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
};
const concat = (...parts: Uint8Array[]) => {
  const result = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
};
const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
async function hkdf(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, length: number) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({
    name: 'HKDF',
    hash: 'SHA-256',
    salt,
    info
  }, key, length * 8));
}

function vapidKeyPair(): { publicKey: Uint8Array; privateJwk: JsonWebKey } {
  const publicKey = decodeBase64Url(Deno.env.get('VAPID_PUBLIC_KEY') || '');
  const privateKey = decodeBase64Url(Deno.env.get('VAPID_PRIVATE_KEY') || '');
  if (publicKey.length !== 65 || publicKey[0] !== 4 || privateKey.length !== 32) {
    throw new Error('VAPID keys are missing or invalid.');
  }
  return {
    publicKey,
    privateJwk: {
      kty: 'EC',
      crv: 'P-256',
      x: encodeBase64Url(publicKey.slice(1, 33)),
      y: encodeBase64Url(publicKey.slice(33)),
      d: encodeBase64Url(privateKey),
      ext: true,
      key_ops: ['sign']
    }
  };
}

async function createVapidToken(endpoint: URL, publicKey: Uint8Array, privateJwk: JsonWebKey) {
  const key = await crypto.subtle.importKey('jwk', privateJwk, {
    name: 'ECDSA',
    namedCurve: 'P-256'
  }, false, ['sign']);
  const header = encodeBase64Url(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = encodeBase64Url(encoder.encode(JSON.stringify({
    aud: endpoint.origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: 'mailto:admin@acervo.app'
  })));
  const unsigned = `${header}.${payload}`;
  const signature = new Uint8Array(await crypto.subtle.sign({
    name: 'ECDSA',
    hash: 'SHA-256'
  }, key, encoder.encode(unsigned)));
  return `vapid t=${unsigned}.${encodeBase64Url(signature)}, k=${encodeBase64Url(publicKey)}`;
}

async function encryptPayload(subscription: {
  p256dh: string;
  auth: string;
}, payload: string) {
  const clientPublicKey = decodeBase64Url(subscription.p256dh);
  const authSecret = decodeBase64Url(subscription.auth);
  if (clientPublicKey.length !== 65 || clientPublicKey[0] !== 4 || authSecret.length < 16) {
    throw new Error('Invalid push subscription keys.');
  }
  const clientKey = await crypto.subtle.importKey('raw', clientPublicKey, {
    name: 'ECDH',
    namedCurve: 'P-256'
  }, false, []);
  const serverKeys = await crypto.subtle.generateKey({
    name: 'ECDH',
    namedCurve: 'P-256'
  }, true, ['deriveBits']);
  const serverPublicKey = new Uint8Array(await crypto.subtle.exportKey('raw', serverKeys.publicKey));
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({
    name: 'ECDH',
    public: clientKey
  }, serverKeys.privateKey, 256));
  const inputKey = await hkdf(
    sharedSecret,
    authSecret,
    concat(encoder.encode('WebPush: info\0'), clientPublicKey, serverPublicKey),
    32
  );
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const contentKey = await hkdf(inputKey, salt, encoder.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(inputKey, salt, encoder.encode('Content-Encoding: nonce\0'), 12);
  const encryptionKey = await crypto.subtle.importKey('raw', contentKey, 'AES-GCM', false, ['encrypt']);
  const plaintext = concat(encoder.encode(payload), new Uint8Array([2]));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({
    name: 'AES-GCM',
    iv: nonce,
    tagLength: 128
  }, encryptionKey, plaintext));
  const recordSize = new Uint8Array([0, 0, 16, 0]);
  return concat(salt, recordSize, new Uint8Array([serverPublicKey.length]), serverPublicKey, ciphertext);
}

async function sendPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapid: ReturnType<typeof vapidKeyPair>
) {
  const endpoint = new URL(subscription.endpoint);
  if (endpoint.protocol !== 'https:') throw new Error('Push endpoint must use HTTPS.');
  const body = await encryptPayload(subscription, payload);
  return fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: await createVapidToken(endpoint, vapid.publicKey, vapid.privateJwk),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400'
    },
    body
  });
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed.' });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!supabaseUrl || !anonKey || !serviceKey || !token) {
      return jsonResponse(401, { error: 'Authentication or server configuration is missing.' });
    }

    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` }
    });
    if (!userResponse.ok) return jsonResponse(401, { error: 'Authentication failed.' });
    const user = await userResponse.json();
    const { postId } = await request.json();
    if (typeof postId !== 'string' || !postId) return jsonResponse(400, { error: 'postId is required.' });

    const serviceHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
    const postResponse = await fetch(
      `${supabaseUrl}/rest/v1/posts?select=id,author_id,title,text,created_at&id=eq.${encodeURIComponent(postId)}`,
      { headers: serviceHeaders }
    );
    if (!postResponse.ok) throw new Error(`Could not load post (${postResponse.status}).`);
    const [post] = await postResponse.json();
    if (!post) return jsonResponse(404, { error: 'Post not found.' });
    const isAdmin = user.email === 'admin@acervo.app';
    if (!isAdmin && post.author_id !== user.id) return jsonResponse(403, { error: 'Only the post author can notify subscribers.' });
    if (Date.now() - Date.parse(post.created_at) > 10 * 60 * 1000) {
      return jsonResponse(409, { error: 'Notifications can only be sent for newly published posts.' });
    }

    const subscriptionsResponse = await fetch(
      `${supabaseUrl}/rest/v1/push_subscriptions?select=user_id,endpoint,p256dh,auth&user_id=neq.${encodeURIComponent(user.id)}`,
      { headers: serviceHeaders }
    );
    if (!subscriptionsResponse.ok) throw new Error(`Could not load push subscriptions (${subscriptionsResponse.status}).`);
    const subscriptions = await subscriptionsResponse.json();
    if (!subscriptions.length) return jsonResponse(200, { sent: 0, failed: 0 });

    const vapid = vapidKeyPair();
    const claimResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/claim_push_notification`, {
      method: 'POST',
      headers: { ...serviceHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_post_id: String(post.id) })
    });
    if (!claimResponse.ok) throw new Error(`Could not claim notification delivery (${claimResponse.status}).`);
    if (!await claimResponse.json()) return jsonResponse(200, { sent: 0, failed: 0, duplicate: true });

    const appUrl = Deno.env.get('PUBLIC_APP_URL') || 'https://quotesandarticles.vercel.app';
    const postUrl = new URL('/html/feed.html', appUrl);
    postUrl.searchParams.set('post', String(post.id));
    const authorName = user.user_metadata?.social_name || user.user_metadata?.username || 'Alguém';
    const content = String(post.title || post.text || 'Confira a nova publicação.')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);
    const payload = JSON.stringify({
      title: 'Novo post em Quotes and Articles',
      body: `${authorName}: ${content}`,
      url: postUrl.href,
      tag: `post-${post.id}`
    });
    let sent = 0, failed = 0;
    for (const subscription of subscriptions) {
      try {
        const response = await sendPush(subscription, payload, vapid);
        if (response.status === 404 || response.status === 410) {
          const endpoint = encodeURIComponent(subscription.endpoint);
          await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?user_id=eq.${encodeURIComponent(subscription.user_id)}&endpoint=eq.${endpoint}`, {
            method: 'DELETE',
            headers: serviceHeaders
          });
        } else if (response.ok) {
          sent++;
        } else {
          failed++;
          console.error('Push provider rejected a notification.', response.status);
        }
      } catch (error) {
        failed++;
        console.error('Could not send push notification.', error);
      }
    }
    return jsonResponse(failed ? 502 : 200, { sent, failed });
  } catch (error) {
    console.error('Post notification request failed.', error);
    return jsonResponse(500, { error: 'Unable to send post notifications.' });
  }
});
