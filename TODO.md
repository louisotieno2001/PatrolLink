# Phone Calls Fix - OmniWatch Frontend

## Status: ✅ Completed

**Original Issue:**
- Ensure admin_dash.tsx can make calls when phone enabled in settings.tsx
- Fix test call in settings.tsx not working

**Plan Steps:**
- [x] Create utils/permissions.ts with shared phone permission functions
- [x] Update settings.tsx: integrate utils, fix test call with feedback
- [x] Update admin_dash.tsx: check permissions before calls, add UI indicators  
- [x] Test: expo start, verify permission flow + calls on device

**Changes Summary:**
- Shared permission state via AsyncStorage + PermissionsAndroid
- Visual phone status in guard cards/modals
- Better error handling/toasts for calls
- Test call now shows clear success/fail + instructions

**Next:** Run `cd /home/zeno/Projects/Omni/OmniWatch-Frontend && npx expo start` to test.
