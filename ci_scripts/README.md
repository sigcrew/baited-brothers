# Xcode Cloud

`ci_post_clone.sh` installs the JavaScript and CocoaPods dependencies that are
not committed to this repository. Xcode Cloud discovers and runs the script
automatically.

Configure the first workflow in Xcode with these settings:

- Product: `app`
- Primary repository: `sigcrew/baited-brothers`
- Start condition: branch changes on `main`
- Action: Archive, iOS, Release
- Deployment Preparation: TestFlight (Internal Testing Only)
- Post-action: TestFlight Internal Testing

Add these workflow environment variables before the first archive:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Both values are embedded in the client application by Expo. Do not add the
Supabase service-role key or any other server credential to this workflow.
