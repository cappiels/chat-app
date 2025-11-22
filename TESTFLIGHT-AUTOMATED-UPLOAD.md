# TestFlight Automated Upload via Terminal

## Setup (One-time)

### 1. Create App Store Connect API Key
1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Navigate to **Users and Access** → **Keys** tab
3. Click **Generate API Key** or **+**
4. Name: `CI/CD Upload Key`
5. Access: **App Manager** (or **Admin** for full access)
6. Click **Generate**
7. **Download the `.p8` file** (you can only download once!)
8. Note the **Key ID** (e.g., `ABC123XYZ`)
9. Note the **Issuer ID** (at top of Keys page, e.g., `12345678-1234-1234-1234-123456789012`)

### 2. Store API Key Securely
```bash
# Create directory for keys (if not exists)
mkdir -p ~/private_keys

# Move the downloaded key
mv ~/Downloads/AuthKey_ABC123XYZ.p8 ~/private_keys/

# Secure permissions
chmod 600 ~/private_keys/AuthKey_ABC123XYZ.p8
```

### 3. Set Environment Variables
Add to your `~/.zshrc` or `~/.bash_profile`:

```bash
# App Store Connect API credentials
export ASC_KEY_ID="ABC123XYZ"
export ASC_ISSUER_ID="12345678-1234-1234-1234-123456789012"
export ASC_KEY_PATH="$HOME/private_keys/AuthKey_ABC123XYZ.p8"
```

Then reload:
```bash
source ~/.zshrc  # or source ~/.bash_profile
```

## Manual Upload Command

```bash
xcrun altool --upload-app \
  --type ios \
  --file mobile/build/ios/ipa/mobile.ipa \
  --apiKey $ASC_KEY_ID \
  --apiIssuer $ASC_ISSUER_ID
```

## Automated Upload in deploy-prod.sh

Add this to the end of `deploy-prod.sh`:

```bash
# Optional: Auto-upload to TestFlight
if [ ! -z "$ASC_KEY_ID" ] && [ ! -z "$ASC_ISSUER_ID" ]; then
    echo ""
    read -p "📤 Upload IPA to TestFlight? (y/n) [n]: " UPLOAD_CHOICE
    if [ "$UPLOAD_CHOICE" = "y" ]; then
        echo "🚀 Uploading to TestFlight..."
        xcrun altool --upload-app \
          --type ios \
          --file mobile/build/ios/ipa/mobile.ipa \
          --apiKey $ASC_KEY_ID \
          --apiIssuer $ASC_ISSUER_ID
        
        if [ $? -eq 0 ]; then
            echo "✅ Upload successful!"
            echo "⏱️  Processing time: 5-10 minutes"
            echo "📱 Check App Store Connect for build availability"
        else
            echo "❌ Upload failed"
        fi
    fi
else
    echo "⚠️  TestFlight auto-upload not configured"
    echo "💡 Set ASC_KEY_ID and ASC_ISSUER_ID environment variables"
    echo "📤 Manual upload:"
    echo "   1. Open Transporter app"
    echo "   2. Drag mobile/build/ios/ipa/mobile.ipa"
    echo "   3. Wait for processing (5-10 minutes)"
fi
```

## Alternative: Using `altool` with Username/Password (App-Specific Password)

**Note:** This method is deprecated and will be removed. Use API Keys instead.

```bash
# Generate app-specific password at appleid.apple.com
xcrun altool --upload-app \
  --type ios \
  --file mobile/build/ios/ipa/mobile.ipa \
  --username "your@email.com" \
  --password "@keychain:AC_PASSWORD"
```

## Troubleshooting

### Error: "Unable to upload archive"
- Ensure the IPA was built successfully
- Check that the API key has "App Manager" access
- Verify the `.p8` file path is correct

### Error: "API key not found"
- Double-check `ASC_KEY_ID` matches the Key ID from App Store Connect
- Ensure the `.p8` filename includes the correct Key ID (e.g., `AuthKey_ABC123XYZ.p8`)

### Error: "Unable to authenticate"
- Verify `ASC_ISSUER_ID` is correct
- Check that the API key hasn't been revoked in App Store Connect

### Upload is slow
- This is normal. Apple's servers can take 2-5 minutes to upload
- IPA size is ~25MB, so network speed matters

## Verification

After successful upload:
1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Navigate to **My Apps** → **Crew Chat** → **TestFlight**
3. Wait 5-10 minutes for processing
4. Build will appear under **iOS Builds**
5. Add to **Internal Testing** or **External Testing** groups

## Security Best Practices

1. ✅ **Never commit** `.p8` files to git
2. ✅ **Never share** API keys publicly
3. ✅ Store keys in `~/private_keys/` with `chmod 600`
4. ✅ Use environment variables for credentials
5. ✅ Rotate API keys every 6-12 months
6. ❌ **Don't use** username/password method (deprecated)

## Full Automated Workflow

With everything configured:

```bash
# One command to deploy everything
./deploy-prod.sh patch "Your changes"

# Prompt will ask if you want to upload to TestFlight
# Type 'y' to auto-upload, 'n' to use Transporter
```

## Benefits of Automated Upload

- ⚡ **Faster**: No need to open Transporter app
- 🤖 **Scriptable**: Can be integrated into CI/CD
- 📊 **Better logging**: Terminal output for debugging
- 🔄 **Repeatable**: Same command every time
- 🚀 **One-step deploy**: Build + Upload in one command
