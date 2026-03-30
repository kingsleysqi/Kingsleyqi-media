/** * /api/upload/[token] * GET ?password= → token info / needPassword / 错误 * POST { fileName, contentType, password? } → { url, key } */
export async function onRequest({ params, request, env }) {
    if (request.method === "OPTIONS") return cors();
    const tokenId = params.token;
    if (!tokenId) return json({ error: "Not found" }, 404);
    
    let token;
    try {
        const obj = await env.MEDIA_BUCKET.get(
            `_admin/upload-tokens/${tokenId}.json`
        );
        if (!obj) return json({ error: "Invalid upload link" }, 404);
        token = await obj.json();
    } catch {
        return json({ error: "Invalid upload link" }, 404);
    }
    
    const now = Date.now();
    if (token.startTime && now < token.startTime)
        return json(
            {
                error: "Not started yet",
                notStarted: true,
                startTime: token.startTime,
            },
            403
        );
    if (token.endTime && now > token.endTime)
        return json({ error: "Expired", expired: true }, 410);
    if (token.maxFiles > 0 && token.uploadCount >= token.maxFiles)
        return json({ error: "File limit reached", limitReached: true }, 403);
    
    if (request.method === "GET") {
        const url = new URL(request.url);
        const pw = url.searchParams.get("password") || "";
        if (token.password && !pw)
            return json({
                needPassword: true,
                name: token.name,
                endTime: token.endTime,
                maxFileSize: token.maxFileSize,
            });
        if (token.password && pw !== token.password)
            return json({ error: "Wrong password", wrongPassword: true }, 401);
        return json({
            id: token.id,
            name: token.name,
            endTime: token.endTime,
            maxFiles: token.maxFiles,
            maxFileSize: token.maxFileSize,
            uploadCount: token.uploadCount,
        });
    }
    
    if (request.method === "POST") {
        let body = {};
        try {
            body = await request.json();
        } catch {}
        const { fileName, contentType, password } = body;
        if (token.password && password !== token.password)
            return json({ error: "Wrong password" }, 401);
        if (!fileName) return json({ error: "fileName required" }, 400);
        const safeName = fileName.replace(/[/\\]/g, "_").replace(/\.\.+/g, "_");
        const key = `drive/${token.name}/${safeName}`;
        try {
            const uploadUrl = await generatePresignedUrl(
                env,
                key,
                contentType || "application/octet-stream"
            );
            incrementCount(env, tokenId, token).catch(console.error);
            return json({ url: uploadUrl, key });
        } catch (err) {
            return json({ error: err.message }, 500);
        }
    }
    
    return json({ error: "Method not allowed" }, 405);
}

async function incrementCount(env, tokenId, token) {
    token.uploadCount = (token.uploadCount || 0) + 1;
    await env.MEDIA_BUCKET.put(
        `_admin/upload-tokens/${tokenId}.json`,
        JSON.stringify(token),
        {
            httpMetadata: { contentType: "application/json" },
        }
    );
}

async function generatePresignedUrl(env, key, contentType) {
    const {
        CF_ACCOUNT_ID: accountId,
        R2_BUCKET_NAME: bucketName,
        R2_ACCESS_KEY_ID: accessKey,
        R2_SECRET_ACCESS_KEY: secretKey,
    } = env;
    if (!accountId || !bucketName || !accessKey || !secretKey)
        throw new Error("R2 not configured");
    const region = "auto",
        expires = 3600;
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, "");
    const datetime = now.toISOString().replace(/[:-]/g, "").slice(0, 15) + "Z";
    const scope = `${date}/${region}/s3/aws4_request`;
    const credential = `${accessKey}/${scope}`;
    const signedHeaders = "host";
    const canonicalHeaders = `host:${accountId}.r2.cloudflarestorage.com\n`;
    const qs = [
        `X-Amz-Algorithm=AWS4-HMAC-SHA256`,
        `X-Amz-Credential=${encodeURIComponent(credential)}`,
        `X-Amz-Date=${datetime}`,
        `X-Amz-Expires=${expires}`,
        `X-Amz-SignedHeaders=${signedHeaders}`,
    ].join("&");
    const encodedKey = key.split("/").map(encodeURIComponent).join("/");
    const canonicalReq = [
        "PUT",
        `/${bucketName}/${encodedKey}`,
        qs,
        canonicalHeaders,
        signedHeaders,
        "UNSIGNED-PAYLOAD",
    ].join("\n");
    const strToSign = [
        "AWS4-HMAC-SHA256",
        datetime,
        scope,
        await sha256hex(canonicalReq),
    ].join("\n");
    const signingKey = await getSigningKey(secretKey, date, region);
    const signature = await hmacHex(signingKey, strToSign);
    return `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${encodedKey}?${qs}&X-Amz-Signature=${signature}`;
}
async function sha256hex(str) {
    const buf = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(str)
    );
    return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}
async function hmacRaw(key, data) {
    const k =
        typeof key === "string" ?
        await crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"]
        ) :
        await crypto.subtle.importKey(
            "raw",
            key, { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"]
        );
    return new Uint8Array(
        await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(data))
    );
}
async function hmacHex(key, data) {
    return Array.from(await hmacRaw(key, data))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}
async function getSigningKey(secretKey, date, region) {
    const kDate = await hmacRaw(`AWS4${secretKey}`, date);
    const kRegion = await hmacRaw(kDate, region);
    const kService = await hmacRaw(kRegion, "s3");
    return hmacRaw(kService, "aws4_request");
}

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
    });
}

function cors() {
    return new Response(null, {
        status: 204,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
    });
}