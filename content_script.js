async function getStoredLogin() {
  if (!navigator.credentials || !navigator.credentials.get) {
    console.warn("Credential Management API not supported");
    return null;
  }

  try {
    // Try to silently fetch a password credential for this origin.
    // If exactly one exists, it’s returned without prompting.
    let credential = await navigator.credentials.get({
      password: true,
      mediation: "silent", // no UI if more than one choice
    });

    // If the silent fetch failed (or returned null), you can fall back
    // to showing the credential picker prompt:
    if (!credential) {
      credential = await navigator.credentials.get({
        password: true,
        mediation: "optional", // will show the browser‑managed picker
      });
    }

    if (credential && credential.type === "password") {
      // credential.id is the username, credential.password is the password
      return {
        username: credential.id,
        password: credential.password,
      };
    }
  } catch (e) {
    console.error("Failed to get credentials:", e);
  }
  return null;
}

(async () => {
  const url = window.location.href;
  const host = window.location.host;

  // Always run on these hosts:
  const alwaysHosts = [
    "moodle.rwth-aachen.de",
    "online.rwth-aachen.de",
    "sso.rwth-aachen.de",
  ];

  let shouldRun;
  if (alwaysHosts.includes(host)) {
    shouldRun = true;
  } else {
    const { autoLoginRequested } = await chrome.storage.local.get(
      "autoLoginRequested"
    );
    shouldRun = autoLoginRequested;
  }
  if (!shouldRun) return;

  const { totpSecret } = await chrome.storage.local.get(["totpSecret"]);

  // 1) On Moodle homepage: click the SSO login link
  // 1) On the Angular “desktop” page: click the navbar login button
  {
    const desktopLogin = document.querySelector(
      'a[data-test="co-navbar-menu-login"]'
    );
    if (desktopLogin) {
      desktopLogin.click();
      return;
    }
  }

  // 2) On Moodle homepage: click the SSO login link
  if (url.startsWith("https://moodle.rwth-aachen.de/")) {
    const ssoLink = document.querySelector(
      'a.btn.btn-primary.btn-block[href*="auth/shibboleth/index.php"]'
    );
    if (ssoLink) ssoLink.click();
    return;
  }

  // —————————————————————————
  // 1) On the Angular desktop page:
  //    click the navbar login link as soon as it appears
  // —————————————————————————
  if (url.startsWith("https://online.rwth-aachen.de/")) {
    // click the navbar login link, then immediately trigger the login‑fragment handler
    const clickNavAndLogin = () => {
      const navBtn = document.querySelector(
        'a[data-test="co-navbar-menu-login"]'
      );
      if (navBtn) {
        navBtn.click();
        // after navigation, try the Anmeldung step
        setTimeout(tryAnmeldungClick, 500);
        return true;
      }
      return false;
    };

    // click the “Zur Anmeldung” button in the login fragment
    const tryAnmeldungClick = () => {
      const zurBtn = Array.from(
        document.querySelectorAll("button.ca-button.btn.btn-primary.btn-block")
      ).find((btn) => btn.textContent.trim().includes("Zur Anmeldung"));
      if (zurBtn) {
        zurBtn.click();
        return true;
      }
      return false;
    };

    // 1) If nav‑login is already there, click it & schedule Anmeldung
    if (clickNavAndLogin()) return;

    // 2) On every hash change, try both steps in sequence
    window.addEventListener("hashchange", () => {
      if (clickNavAndLogin()) return;
      tryAnmeldungClick();
    });

    // 3) Poll for up to 10s in case rendering is delayed
    let attempts = 0;
    const interval = setInterval(() => {
      if (clickNavAndLogin() || tryAnmeldungClick() || attempts++ > 20) {
        clearInterval(interval);
      }
    }, 500);

    return;
  }

  // 4) On SSO page (execution=e1s1): fill creds, store them, then click “Anmeldung”
  if (url.includes("execution=") && url.includes("s1")) {
    // 2a) Try browser‑vault first
    const creds = await getStoredLogin();

    // 2c) Fill the form
    const userInput = document.querySelector('input[name="j_username"]');
    const passInput = document.querySelector('input[name="j_password"]');
    if (userInput && passInput && creds) {
      userInput.value = creds.username;
      passInput.value = creds.password;

      // 2e) Submit the form
      document.querySelector('button#login[name="_eventId_proceed"]')?.click();
    } else {
      // 2b) If no credentials were found, show a warning
      alert(
        "No credentials found in the browser vault. Please enter them manually."
      );
    }
    return;
  }

  // 5) Token‑selection page (e1s2): choose your dropdown and click “Weiter”
  if (url.includes("execution=") && url.includes("s2")) {
    const { dropdownValue } = await chrome.storage.local.get("dropdownValue");
    const selectElem = document.querySelector(
      "#fudis_selected_token_ids_input"
    );
    if (selectElem && dropdownValue) {
      selectElem.value = dropdownValue;
      selectElem.dispatchEvent(new Event("change", { bubbles: true }));
    }
    document.querySelector('button[name="_eventId_proceed"]')?.click();
    return;
  }

  // 6–7) OTP page: generate & submit TOTP, then clear the flag
  const otpInput = document.querySelector("#fudis_otp_input");
  if (otpInput) {
    if (!totpSecret) {
      alert("Please set your TOTP secret in the extension options.");
      return;
    }

    try {
      const code = await generateTOTP(totpSecret);
      otpInput.value = code;
      const verifyBtn = document.querySelector(
        'button[name="_eventId_proceed"]'
      );
      if (verifyBtn) verifyBtn.click();
    } catch (e) {
      console.error("TOTP generation failed", e);
      alert("Failed to generate TOTP — check your secret.");
    }

    // stop further automation once OTP is submitted
    chrome.storage.local.set({ autoLoginRequested: false });
  }
})();

// ——— Helpers for TOTP ———

// Decode a Base32 string to a Uint8Array
function base32ToBytes(base32) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "",
    bytes = [];
  for (let char of base32) {
    const val = alphabet.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return new Uint8Array(bytes);
}

// Generate a 6‑digit TOTP code given a Base32 secret
async function generateTOTP(secret) {
  const keyBytes = base32ToBytes(secret);
  const epoch = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epoch / 30);

  // Prepare 8‑byte big‑endian counter
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setUint32(4, counter);

  // Import key & compute HMAC‑SHA1
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const hmac = new Uint8Array(
    await crypto.subtle.sign("HMAC", cryptoKey, buffer)
  );

  // Dynamic truncation
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    (((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff)) %
    1e6;

  return String(code).padStart(6, "0");
}
