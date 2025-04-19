// ——— base32 & TOTP helpers (unchanged) ———
function base32ToBytes(base32) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "",
    bytes = [];
  for (let char of base32.replace(/\s+/g, "").toUpperCase()) {
    const val = alphabet.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return new Uint8Array(bytes);
}
async function generateTOTP(secret) {
  const keyBytes = base32ToBytes(secret);
  const epoch = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epoch / 30);
  const buf = new ArrayBuffer(8);
  new DataView(buf).setUint32(4, counter);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const hmac = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, buf));
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    (((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff)) %
    1e6;
  return String(code).padStart(6, "0");
}

// ——— Options logic ———
document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(
    ["username", "password", "totpSecret", "dropdownValue"],
    (data) => {
      document.getElementById("username").value = data.username || "";
      document.getElementById("password").value = data.password || "";
      document.getElementById("totpSecret").value = data.totpSecret || "";
      document.getElementById("dropdownValue").value = data.dropdownValue || "";
    }
  );
});

document.getElementById("save").addEventListener("click", async () => {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  const totpSecret = document.getElementById("totpSecret").value.trim();
  const dropdownValue = document.getElementById("dropdownValue").value.trim();

  await new Promise((res) =>
    chrome.storage.local.set(
      { username, password, totpSecret, dropdownValue },
      res
    )
  );

  // generate & display TOTP
  if (totpSecret) {
    try {
      const code = await generateTOTP(totpSecret);
      document.getElementById("totpDisplay").textContent = code;
      document.getElementById("totpContainer").hidden = false;
    } catch (e) {
      alert("Error generating TOTP. Check your secret.");
      console.error(e);
    }
  } else {
    alert("Bitte gib einen gültigen TOTP‑Secret ein.");
  }
});
