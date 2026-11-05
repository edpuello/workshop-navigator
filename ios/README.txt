Workshop Navigator — iPhone & iPad app (version 1.0, build 2) · web pages 10.6 · Nov 4, 2026

READY TO BUILD: signing is set (team 53HN6NLUDU, Edgar Puello), the Supabase library is
already in vendor/ and www/vendor/ (prepare.sh not needed), and www/ holds website 10.6.
This is exactly what's installed on Ed's iPhone (Nov 4).

NEW in build 2
- Runs as a full iPad app too (any orientation), not just iPhone.
- Finds the ZD421 on the network even when Bonjour is off: it looks over the
  home network for printers on the label port and checks the printer's own web
  page says Zebra before asking its name, so other printers never print junk.
- Header stays put when you switch Checklist ⇄ Workshop (website 10.5).

What it does that the website can't
- Prints straight from the iPhone or iPad to the Zebra ZD421:
    • over the network (Ethernet or Wi-Fi) — found automatically, or add it by IP address
    • over Bluetooth LE — the printer just needs to be on and nearby
- AirPrint labels at exact size (or a sheet to cut out)
- Scan button next to the search bar: point at a drawer label and that drawer opens
- Works offline; syncs your list through your account when online
- Same Workshop pages as the website (Labs is left out of the app for now)

ON THE MAC — first time (about 15 minutes)
1. Install Xcode from the Mac App Store and open it once so it finishes setting up.
   In Xcode → Settings → Accounts, sign in with your Apple Developer account.
2. Copy this whole "WorkshopNavigator-iOS" folder to the Mac (e.g. Desktop).
3. Open Terminal, go into the folder and run the prepare step (downloads the
   Supabase library the app bundles for cloud sync):
       cd ~/Desktop/WorkshopNavigator-iOS
       bash prepare.sh
4. Double-click WorkshopNavigator.xcodeproj to open it in Xcode.
5. Click "WorkshopNavigator" at the top of the left column → target
   WorkshopNavigator → "Signing & Capabilities":
       • Team: pick your developer team
       • Bundle Identifier: com.edpuello.workshopnavigator (change it now if you
         want a different one — it can't change after the first upload)
6. Plug in your iPhone or iPad (or pick it from the device menu at the top), then press ▶ Run.
   The first time, on the device: Settings → General → VPN & Device Management →
   trust your developer account, and turn on Developer Mode if it asks.
7. In the app: ••• → Labels & printer.
   • Network: the ZD421 shows up if it's on the same network as the iPhone/iPad.
     If not, type its IP address under "Add a network printer". To see the IP,
     print the printer's configuration report: hold FEED and CANCEL together for
     about 2 seconds (Zebra calls it the CANCEL self test).
     Allow "Local Network" when it asks.
   • Bluetooth: turn the printer on next to you, tap "Look again", allow Bluetooth.
   Pick it with "Use", then "Test".

UPDATING THE WEB PAGES INSIDE THE APP
This folder lives inside the website repo (repo/ios). When the website changes,
run this on the Mac from the ios folder, then press Run again in Xcode:
       bash build-www.sh          (copies the website from the repo root into www/)

TESTFLIGHT / APP STORE (later)
Product → Archive → Distribute App → App Store Connect. Use TestFlight first.
Before submitting for review: privacy policy + support pages, account deletion,
listing and screenshots (see the "App Store readiness" doc).

If Xcode won't open the project: install XcodeGen (brew install xcodegen), run
"xcodegen" in this folder, and open the WorkshopNavigator.xcodeproj it makes.

Files
  WorkshopNavigator/         Swift code, app icon, privacy manifest
    NativeBridge.swift       what the web pages can ask the iPhone/iPad to do
    ZebraNetwork.swift       printing over the network (port 9100)
    ZebraBLE.swift           printing over Bluetooth LE (Zebra's print service)
    CodeScanner.swift        camera label scanner
    AirPrinter.swift         AirPrint at exact label size
  www/                       the Workshop web pages bundled in the app
  Info.plist                 app settings and the permission messages
