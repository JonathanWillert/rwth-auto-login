# RWTH Auto Login Chrome Extension

This Chrome extension automates the login process for RWTH Aachen via the RWTH Single Sign‑On (Shibboleth) system—including username/password authentication and TOTP (Time‑based One‑Time Password) second factor.

---

## 🚀 How It Works

1. **Trigger**: Direct to one of the websites (moodle, onlineRWTH) or click the extension icon in your toolbar to navigate to Moodle.
2. **Moodle Home**: Opens `https://moodle.rwth-aachen.de/` and clicks the “Login via RWTH Single Sign‑on” link.
   **RWTH online**: Opens `https://online.rwth-aachen.de/` and clicks the “Anmelden” button. After that it clicks on “ Zur Anmeldung”
3. **Shibboleth Login **: Fills in your RWTH username and password (stored in extension options) and clicks “Anmeldung”
4. **Shibboleth Selection **: Automatically selects your Seriennummer and click “Weiter.”
5. **TOTP Factor**: Generates a 6‑digit TOTP code from your stored Base32 secret, injects it into the page, and clicks “Überprüfen.”

All credentials and the TOTP secret are stored locally in Chrome’s storage. The extension never sends your data anywhere.

---

## 🛠 Installation

1. Clone or download the `rwth-auto-login/` folder from the repository.
2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode** (toggle at top right).
4. Click **Load unpacked** and select the `rwth-auto-login/` folder.
5. Click the extension’s **Options** button to configure credentials and your TOTP secret.

---

## ⚙️ Configuration

1. Click the extension and select **Options**.
2. Enter your:
   - **Username** (Format: `ab123456`)
   - **Password**
   - **TOTP Secret** (Base32 string from RWTH Tokenmanager)
   - **Dropdown Option Value** (exact value you see on the Shibboleth step‑2 page)
3. Click **Save**. The current TOTP code will appear below for you to verify against your Authenticator app.

---

## 🔑 Obtaining Your TOTP Secret

1. Go to **RWTH Self‑Service**: https://selfservice.rwth-aachen.de/
2. Log in with your RWTH credentials.
3. Navigate to **Tokenmanager (MFA)**.
4. Click **Create New Token**.
5. Select **Authenticator App** (z.B. für Smartphone (TOTP)).¹
6. Enter a **Description** for your token (e.g., `Chrome Extension`).
7. Click on **Token Geheimnis** to reveal your Base32 secret.
8. **Copy** the Token Geheimnis value and paste it into the extension’s **TOTP Secret** field.
9. On the same page, copy the **Seriennummer** from the first line (optional reference).

> **Note:** Keep your TOTP secret and Seriennummer safe. Anyone with this secret can generate valid codes for your account.

---

## 🎯 Usage

1. Click the extension icon in Chrome.
2. A new tab opens and the SSO flow runs automatically:
   - Clicks through Moodle → Shibboleth → Token page.
   - Fills and submits username, password, dropdown selection, and TOTP.
3. You’ll be logged into Moodle without manual input (apart from the first‑time configuration).

---

## ⚠️ Security Notice

- Your password and token secret are stored in plain‑text in Chrome local storage—use only on trusted machines.
- Do not share your extension folder or settings file with others.

---

¹ _TOTP (Time‑based One‑Time Password) is the standard used by Google Authenticator, Authy, etc._
