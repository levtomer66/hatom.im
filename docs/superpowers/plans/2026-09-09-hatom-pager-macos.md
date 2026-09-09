# Hatom Pager macOS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a separate always-on macOS menu-bar app that polls a dedicated PagerDuty service, wakes all displays, presents and sounds active pages, and acknowledges them.

**Architecture:** `hatom-pager` treats PagerDuty's triggered-incident list as its only page snapshot. A small PagerDuty client hides REST details behind three operations: list triggered incidents, fetch one page payload, and acknowledge one incident. The app keeps macOS awake while armed, but lets displays sleep; presentation and audio react to the in-memory active-page queue.

**Tech Stack:** Swift 6, SwiftUI, AppKit, Foundation, IOKit, AVFoundation, Security, ServiceManagement, PagerDuty REST API v2, XcodeGen, macOS 13+

## Global Constraints

- Follow `docs/superpowers/specs/2026-09-09-paging-system-design.md`.
- Create a separate repository at `/Users/tomer.l/repos/hatom-pager`.
- After creating and initializing that directory, move the Cursor agent root
  there before scaffolding or editing project files.
- Do not create README, CLAUDE, AGENTS, design, or other documentation files
  without separate user approval.
- Do not add an automated test target or test files unless the user explicitly
  requests them.
- Do not persist pages or acknowledgement retries; PagerDuty is the source of
  truth and all runtime queues are memory-only.
- Store the PagerDuty REST token only in Keychain under service
  `im.hatom.pager`, account `pagerduty-rest-token`.
- Never log the token or an Authorization header.
- Poll only the configured Hatom Paging service, normally every five seconds.
- Respect `Retry-After` and never interpret a failed poll as an empty snapshot.
- Keep the system awake only while armed; allow normal display sleep.
- Do not attempt to bypass the macOS secure lock screen.
- The PagerDuty custom-details contract is exactly `emoji`, `message`,
  `caller_email`, `source`, and `page_id`.
- Manual verification replaces new automated tests.

---

### Task 1: Create and build the native app shell

**Files:**
- Create: `/Users/tomer.l/repos/hatom-pager/project.yml`
- Create: `/Users/tomer.l/repos/hatom-pager/HatomPager/App/HatomPagerApp.swift`
- Create: `/Users/tomer.l/repos/hatom-pager/HatomPager/App/AppDelegate.swift`
- Create: `/Users/tomer.l/repos/hatom-pager/HatomPager/App/AppState.swift`
- Create: `/Users/tomer.l/repos/hatom-pager/HatomPager/UI/MenuBarView.swift`

**Interfaces:**
- Produces: `HatomPagerApp` menu-bar process
- Produces: `AppState.shared`
- Produces: generated `HatomPager.xcodeproj`

- [ ] **Step 1: Create and select the repository**

Run:

```bash
mkdir -p /Users/tomer.l/repos/hatom-pager
cd /Users/tomer.l/repos/hatom-pager
git init -b main
```

Immediately call Cursor's `move_agent_to_root` with
`/Users/tomer.l/repos/hatom-pager` before creating `project.yml` or source
files.

If `xcodegen` is unavailable, install it:

```bash
brew install xcodegen
```

- [ ] **Step 2: Define the reproducible Xcode project**

Create `project.yml`:

```yaml
name: HatomPager
options:
  bundleIdPrefix: im.hatom
  deploymentTarget:
    macOS: "13.0"
settings:
  base:
    SWIFT_VERSION: "6.0"
    SWIFT_STRICT_CONCURRENCY: complete
    ENABLE_HARDENED_RUNTIME: YES
targets:
  HatomPager:
    type: application
    platform: macOS
    sources:
      - path: HatomPager
        excludes:
          - Resources
    resources:
      - path: HatomPager/Resources
    settings:
      base:
        PRODUCT_BUNDLE_IDENTIFIER: im.hatom.pager
        PRODUCT_NAME: Hatom Pager
        GENERATE_INFOPLIST_FILE: YES
        INFOPLIST_KEY_CFBundleDisplayName: Hatom Pager
        INFOPLIST_KEY_LSUIElement: YES
        CODE_SIGN_STYLE: Automatic
        ENABLE_APP_SANDBOX: NO
schemes:
  HatomPager:
    build:
      targets:
        HatomPager: all
    run:
      config: Debug
```

Create the empty resource directory before generation:

```bash
mkdir -p HatomPager/Resources
xcodegen generate
```

- [ ] **Step 3: Add the initial observable state**

Create `HatomPager/App/AppState.swift`:

```swift
import Combine
import Foundation

@MainActor
final class AppState: ObservableObject {
    static let shared = AppState()

    @Published private(set) var isArmed = false
    @Published private(set) var statusText = "Disarmed"

    private init() {}

    func setArmed(_ armed: Bool) {
        isArmed = armed
        statusText = armed ? "Armed" : "Disarmed"
    }

    func shutdown() {
        setArmed(false)
    }
}
```

- [ ] **Step 4: Add the menu-bar app and lifecycle**

Create `HatomPager/App/HatomPagerApp.swift`:

```swift
import SwiftUI

@main
struct HatomPagerApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self)
    private var appDelegate
    @StateObject private var state = AppState.shared

    var body: some Scene {
        MenuBarExtra {
            MenuBarView()
                .environmentObject(state)
        } label: {
            Label("Hatom Pager", systemImage: state.isArmed ? "bell.badge.fill" : "bell.slash")
        }
        .menuBarExtraStyle(.menu)

        Settings {
            Text("Settings arrive in the next slice.")
                .padding()
        }
    }
}
```

Create `HatomPager/App/AppDelegate.swift`:

```swift
import AppKit

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApplication.shared.setActivationPolicy(.accessory)
    }

    func applicationWillTerminate(_ notification: Notification) {
        AppState.shared.shutdown()
    }
}
```

Create `HatomPager/UI/MenuBarView.swift`:

```swift
import SwiftUI

struct MenuBarView: View {
    @EnvironmentObject private var state: AppState

    var body: some View {
        Text(state.statusText)
        Button(state.isArmed ? "Disarm" : "Arm") {
            state.setArmed(!state.isArmed)
        }
        Divider()
        Button("Settings…") {
            NSApplication.shared.sendAction(
                Selector(("showSettingsWindow:")),
                to: nil,
                from: nil
            )
        }
        Button("Quit") {
            NSApplication.shared.terminate(nil)
        }
    }
}
```

- [ ] **Step 5: Generate and build**

```bash
xcodegen generate
xcodebuild \
  -project HatomPager.xcodeproj \
  -scheme HatomPager \
  -configuration Debug \
  -derivedDataPath .build \
  CODE_SIGNING_ALLOWED=NO \
  build
```

Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 6: Commit the app shell**

```bash
git add project.yml HatomPager HatomPager.xcodeproj
git commit -m "feat: scaffold Hatom Pager menu-bar app"
```

---

### Task 2: Add configuration, Keychain, and launch-at-login

**Files:**
- Create: `HatomPager/Settings/PagerDutyConfiguration.swift`
- Create: `HatomPager/Security/KeychainStore.swift`
- Create: `HatomPager/System/LoginItemService.swift`
- Create: `HatomPager/Settings/SettingsView.swift`
- Modify: `HatomPager/App/HatomPagerApp.swift`
- Modify: `HatomPager/App/AppState.swift`

**Interfaces:**
- Produces: `PagerDutyConfiguration.load()`
- Produces: `KeychainStore.loadToken/saveToken/deleteToken`
- Produces: `LoginItemService.setEnabled`
- Consumes: Keychain service/account fixed in Global Constraints

- [ ] **Step 1: Add non-secret configuration**

Create `HatomPager/Settings/PagerDutyConfiguration.swift`:

```swift
import Foundation

struct PagerDutyConfiguration: Equatable, Sendable {
    let serviceID: String
    let fromEmail: String

    var isComplete: Bool {
        !serviceID.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        fromEmail.contains("@")
    }

    static func load(defaults: UserDefaults = .standard) -> Self {
        Self(
            serviceID: defaults.string(forKey: "pagerduty.serviceID") ?? "",
            fromEmail: defaults.string(forKey: "pagerduty.fromEmail") ?? ""
        )
    }

    func save(defaults: UserDefaults = .standard) {
        defaults.set(serviceID.trimmingCharacters(in: .whitespacesAndNewlines),
                     forKey: "pagerduty.serviceID")
        defaults.set(fromEmail.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
                     forKey: "pagerduty.fromEmail")
    }
}
```

- [ ] **Step 2: Add the Keychain adapter**

Create `HatomPager/Security/KeychainStore.swift`:

```swift
import Foundation
import Security

enum KeychainError: Error {
    case status(OSStatus)
    case invalidData
}

struct KeychainStore: Sendable {
    private let service = "im.hatom.pager"
    private let account = "pagerduty-rest-token"

    func saveToken(_ token: String) throws {
        let data = Data(token.utf8)
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: account,
        ]
        let attributes: [CFString: Any] = [
            kSecValueData: data,
            kSecAttrAccessible: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]
        let status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var inserted = query
            attributes.forEach { inserted[$0.key] = $0.value }
            let addStatus = SecItemAdd(inserted as CFDictionary, nil)
            guard addStatus == errSecSuccess else { throw KeychainError.status(addStatus) }
        } else if status != errSecSuccess {
            throw KeychainError.status(status)
        }
    }

    func loadToken() throws -> String? {
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: account,
            kSecReturnData: true,
            kSecMatchLimit: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess else { throw KeychainError.status(status) }
        guard let data = item as? Data, let token = String(data: data, encoding: .utf8) else {
            throw KeychainError.invalidData
        }
        return token
    }

    func deleteToken() throws {
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: account,
        ]
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainError.status(status)
        }
    }
}
```

- [ ] **Step 3: Add launch-at-login control**

Create `HatomPager/System/LoginItemService.swift`:

```swift
import ServiceManagement

struct LoginItemService {
    var isEnabled: Bool {
        SMAppService.mainApp.status == .enabled
    }

    func setEnabled(_ enabled: Bool) throws {
        if enabled {
            if SMAppService.mainApp.status != .enabled {
                try SMAppService.mainApp.register()
            }
        } else if SMAppService.mainApp.status == .enabled {
            try SMAppService.mainApp.unregister()
        }
    }
}
```

- [ ] **Step 4: Build the settings form**

Create `HatomPager/Settings/SettingsView.swift` with `@State` values for
service ID, PagerDuty user email, REST token, launch-at-login, and visible
save feedback. The save action must call:

```swift
let configuration = PagerDutyConfiguration(
    serviceID: serviceID,
    fromEmail: fromEmail
)
configuration.save()
try KeychainStore().saveToken(token.trimmingCharacters(in: .whitespacesAndNewlines))
try LoginItemService().setEnabled(launchAtLogin)
AppState.shared.reloadConfiguration()
```

The complete view interface is:

```swift
import SwiftUI

struct SettingsView: View {
    @State private var serviceID = PagerDutyConfiguration.load().serviceID
    @State private var fromEmail = PagerDutyConfiguration.load().fromEmail
    @State private var token = (try? KeychainStore().loadToken()) ?? ""
    @State private var launchAtLogin = LoginItemService().isEnabled
    @State private var feedback: String?

    var body: some View {
        Form {
            TextField("PagerDuty service ID", text: $serviceID)
            TextField("PagerDuty user email", text: $fromEmail)
            SecureField("PagerDuty REST token", text: $token)
            Toggle("Launch at login", isOn: $launchAtLogin)
            if let feedback { Text(feedback) }
            Button("Save") { save() }
        }
        .padding(20)
        .frame(width: 480)
    }

    private func save() {
        do {
            let configuration = PagerDutyConfiguration(
                serviceID: serviceID,
                fromEmail: fromEmail
            )
            guard configuration.isComplete, !token.trimmingCharacters(in: .whitespaces).isEmpty
            else {
                feedback = "Service ID, email, and token are required."
                return
            }
            configuration.save()
            try KeychainStore().saveToken(token.trimmingCharacters(in: .whitespacesAndNewlines))
            try LoginItemService().setEnabled(launchAtLogin)
            AppState.shared.reloadConfiguration()
            feedback = "Saved."
        } catch {
            feedback = "Could not save settings: \(error.localizedDescription)"
        }
    }
}
```

- [ ] **Step 5: Wire settings and arming eligibility**

Replace the temporary `Settings` scene with:

```swift
Settings {
    SettingsView()
}
```

Expand `AppState` with:

```swift
@Published private(set) var isConfigured = false

func reloadConfiguration() {
    let configuration = PagerDutyConfiguration.load()
    let token = try? KeychainStore().loadToken()
    isConfigured = configuration.isComplete && !(token ?? "").isEmpty
    if !isConfigured { setArmed(false) }
}
```

Call `reloadConfiguration()` from `AppState.init()`. Disable the Arm button
when `!state.isConfigured`.

- [ ] **Step 6: Build and commit**

```bash
xcodegen generate
xcodebuild -project HatomPager.xcodeproj -scheme HatomPager \
  -configuration Debug -derivedDataPath .build CODE_SIGNING_ALLOWED=NO build
git add project.yml HatomPager HatomPager.xcodeproj
git commit -m "feat: add secure PagerDuty configuration"
```

Expected: `** BUILD SUCCEEDED **`; no token appears in `git diff` or generated
project settings.

---

### Task 3: Implement the PagerDuty client

**Files:**
- Create: `HatomPager/Models/PagePayload.swift`
- Create: `HatomPager/Models/PagerDutyModels.swift`
- Create: `HatomPager/PagerDuty/PagerDutyClient.swift`

**Interfaces:**
- Produces: `listTriggeredIncidents() async throws -> [TriggeredIncident]`
- Produces: `fetchPagePayload(for:) async throws -> PagePayload`
- Produces: `acknowledge(incidentID:) async throws`
- Consumes: PagerDuty user token, user email, and service ID

- [ ] **Step 1: Define the domain payload**

Create `HatomPager/Models/PagePayload.swift`:

```swift
import Foundation

struct PagePayload: Identifiable, Equatable, Sendable {
    let id: String
    let incidentNumber: Int
    let emoji: String
    let message: String
    let callerEmail: String
    let source: String
    let pageID: String
    let createdAt: Date
}
```

- [ ] **Step 2: Define only the PagerDuty response fields used by the app**

Create `HatomPager/Models/PagerDutyModels.swift`:

```swift
import Foundation

struct IncidentListResponse: Decodable, Sendable {
    let incidents: [TriggeredIncident]
    let more: Bool
}

struct TriggeredIncident: Decodable, Identifiable, Sendable {
    let id: String
    let incidentNumber: Int
    let title: String
    let status: String
    let createdAt: Date
    let incidentKey: String?
    let service: Reference

    struct Reference: Decodable, Sendable { let id: String }

    enum CodingKeys: String, CodingKey {
        case id, title, status, service
        case incidentNumber = "incident_number"
        case createdAt = "created_at"
        case incidentKey = "incident_key"
    }
}

struct AlertListResponse: Decodable, Sendable {
    let alerts: [Alert]

    struct Alert: Decodable, Sendable {
        let status: String
        let body: Body
    }

    struct Body: Decodable, Sendable {
        let details: Details?
    }

    struct Details: Decodable, Sendable {
        let emoji: String?
        let message: String?
        let callerEmail: String?
        let source: String?
        let pageID: String?

        enum CodingKeys: String, CodingKey {
            case emoji, message, source
            case callerEmail = "caller_email"
            case pageID = "page_id"
        }
    }
}

struct IncidentUpdateEnvelope: Encodable {
    let incident: IncidentUpdate

    struct IncidentUpdate: Encodable {
        let type = "incident_reference"
        let status = "acknowledged"
    }
}
```

- [ ] **Step 3: Implement the REST adapter**

Create `HatomPager/PagerDuty/PagerDutyClient.swift`:

```swift
import Foundation

enum PagerDutyError: Error {
    case invalidURL
    case invalidResponse
    case unauthorized
    case forbidden
    case rateLimited(retryAfter: TimeInterval?)
    case httpStatus(Int)
    case missingAlertDetails
}

actor PagerDutyClient {
    private let token: String
    private let fromEmail: String
    private let serviceID: String
    private let session: URLSession
    private let decoder: JSONDecoder

    init(token: String, fromEmail: String, serviceID: String, session: URLSession = .shared) {
        self.token = token
        self.fromEmail = fromEmail
        self.serviceID = serviceID
        self.session = session
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        self.decoder = decoder
    }

    func listTriggeredIncidents() async throws -> [TriggeredIncident] {
        var components = URLComponents(string: "https://api.pagerduty.com/incidents")
        components?.queryItems = [
            URLQueryItem(name: "statuses[]", value: "triggered"),
            URLQueryItem(name: "service_ids[]", value: serviceID),
            URLQueryItem(name: "sort_by", value: "created_at:desc"),
            URLQueryItem(name: "limit", value: "100"),
        ]
        guard let url = components?.url else { throw PagerDutyError.invalidURL }
        let data = try await send(request(url: url))
        let response = try decoder.decode(IncidentListResponse.self, from: data)
        return response.incidents.filter { $0.service.id == serviceID && $0.status == "triggered" }
    }

    func fetchPagePayload(for incident: TriggeredIncident) async throws -> PagePayload {
        guard let url = URL(
            string: "https://api.pagerduty.com/incidents/\(incident.id)/alerts?limit=100"
        ) else {
            throw PagerDutyError.invalidURL
        }
        let data = try await send(request(url: url))
        let response = try decoder.decode(AlertListResponse.self, from: data)
        guard let details = response.alerts.first(where: { $0.status == "triggered" })?.body.details
        else {
            throw PagerDutyError.missingAlertDetails
        }
        return PagePayload(
            id: incident.id,
            incidentNumber: incident.incidentNumber,
            emoji: details.emoji?.isEmpty == false ? details.emoji! : "📟",
            message: details.message ?? "",
            callerEmail: details.callerEmail ?? "Unknown caller",
            source: details.source ?? "unknown",
            pageID: details.pageID ?? incident.incidentKey ?? incident.id,
            createdAt: incident.createdAt
        )
    }

    func acknowledge(incidentID: String) async throws {
        guard let url = URL(string: "https://api.pagerduty.com/incidents/\(incidentID)")
        else {
            throw PagerDutyError.invalidURL
        }
        var request = request(url: url)
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(fromEmail, forHTTPHeaderField: "From")
        request.httpBody = try JSONEncoder().encode(
            IncidentUpdateEnvelope(incident: .init())
        )
        _ = try await send(request)
    }

    private func request(url: URL) -> URLRequest {
        var request = URLRequest(url: url)
        request.setValue(
            "application/vnd.pagerduty+json;version=2",
            forHTTPHeaderField: "Accept"
        )
        request.setValue("Token token=\(token)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 15
        return request
    }

    private func send(_ request: URLRequest) async throws -> Data {
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw PagerDutyError.invalidResponse
        }
        switch http.statusCode {
        case 200..<300:
            return data
        case 401:
            throw PagerDutyError.unauthorized
        case 403:
            throw PagerDutyError.forbidden
        case 429:
            throw PagerDutyError.rateLimited(
                retryAfter: http.value(forHTTPHeaderField: "Retry-After").flatMap(TimeInterval.init)
            )
        default:
            throw PagerDutyError.httpStatus(http.statusCode)
        }
    }
}
```

Do not print `URLRequest` because it contains the Authorization header.

- [ ] **Step 4: Build and commit**

```bash
xcodegen generate
xcodebuild -project HatomPager.xcodeproj -scheme HatomPager \
  -configuration Debug -derivedDataPath .build CODE_SIGNING_ALLOWED=NO build
git add HatomPager HatomPager.xcodeproj
git commit -m "feat: add PagerDuty incident client"
```

---

### Task 4: Add polling, snapshot reconciliation, and backoff

**Files:**
- Create: `HatomPager/Polling/ConnectivityState.swift`
- Create: `HatomPager/Polling/BackoffPolicy.swift`
- Create: `HatomPager/Polling/PollEngine.swift`

**Interfaces:**
- Produces: `PollEngine.start()` and `PollEngine.stop()`
- Emits: new pages, dismissed incident IDs, connectivity changes
- Consumes: `PagerDutyClient`

- [ ] **Step 1: Define connection state and retry policy**

Create `HatomPager/Polling/ConnectivityState.swift`:

```swift
enum ConnectivityState: Equatable {
    case disconnected
    case connected
    case backingOff(seconds: Int)
}
```

Create `HatomPager/Polling/BackoffPolicy.swift`:

```swift
import Foundation

struct BackoffPolicy {
    let normalInterval: TimeInterval = 5
    let maximumDelay: TimeInterval = 60

    func delay(for error: Error, attempt: Int) -> TimeInterval {
        if let pagerDutyError = error as? PagerDutyError,
           case .rateLimited(let retryAfter) = pagerDutyError {
            return min(maximumDelay, max(1, retryAfter ?? 60))
        }
        let ceiling = min(maximumDelay, pow(2, Double(min(attempt, 6))))
        return Double.random(in: 0...max(1, ceiling))
    }
}
```

- [ ] **Step 2: Implement the polling module**

Create `HatomPager/Polling/PollEngine.swift`:

```swift
import Foundation

@MainActor
final class PollEngine {
    typealias PageHandler = @MainActor (PagePayload) -> Void
    typealias DismissHandler = @MainActor (Set<String>) -> Void
    typealias ConnectivityHandler = @MainActor (ConnectivityState) -> Void

    private let client: PagerDutyClient
    private let policy: BackoffPolicy
    private let onPage: PageHandler
    private let onDismissed: DismissHandler
    private let onConnectivity: ConnectivityHandler
    private var knownIncidentIDs = Set<String>()
    private var task: Task<Void, Never>?

    init(
        client: PagerDutyClient,
        policy: BackoffPolicy = .init(),
        onPage: @escaping PageHandler,
        onDismissed: @escaping DismissHandler,
        onConnectivity: @escaping ConnectivityHandler
    ) {
        self.client = client
        self.policy = policy
        self.onPage = onPage
        self.onDismissed = onDismissed
        self.onConnectivity = onConnectivity
    }

    func start() {
        guard task == nil else { return }
        task = Task { [weak self] in
            guard let self else { return }
            var attempt = 0
            while !Task.isCancelled {
                do {
                    let incidents = try await client.listTriggeredIncidents()
                    let currentIDs = Set(incidents.map(\.id))
                    var detailFetchFailed = false
                    let dismissed = knownIncidentIDs.subtracting(currentIDs)
                    if !dismissed.isEmpty {
                        knownIncidentIDs.subtract(dismissed)
                        onDismissed(dismissed)
                    }
                    for incident in incidents where !knownIncidentIDs.contains(incident.id) {
                        do {
                            let page = try await client.fetchPagePayload(for: incident)
                            knownIncidentIDs.insert(incident.id)
                            onPage(page)
                        } catch {
                            // Leave the ID unknown so the next successful poll retries details.
                            detailFetchFailed = true
                        }
                    }
                    attempt = 0
                    onConnectivity(
                        detailFetchFailed
                            ? .backingOff(seconds: Int(policy.normalInterval))
                            : .connected
                    )
                    try await sleep(seconds: policy.normalInterval)
                } catch is CancellationError {
                    break
                } catch {
                    attempt += 1
                    let delay = policy.delay(for: error, attempt: attempt)
                    onConnectivity(.backingOff(seconds: Int(delay.rounded(.up))))
                    try? await sleep(seconds: delay)
                }
            }
            onConnectivity(.disconnected)
        }
    }

    func stop() {
        task?.cancel()
        task = nil
        knownIncidentIDs.removeAll()
        onConnectivity(.disconnected)
    }

    private func sleep(seconds: TimeInterval) async throws {
        try await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
    }
}
```

The detail-fetch catch intentionally leaves the incident unknown, reports a
degraded state, and retries it on the next poll without logging page contents.

- [ ] **Step 3: Build and commit**

```bash
xcodegen generate
xcodebuild -project HatomPager.xcodeproj -scheme HatomPager \
  -configuration Debug -derivedDataPath .build CODE_SIGNING_ALLOWED=NO build
git add HatomPager HatomPager.xcodeproj
git commit -m "feat: poll and reconcile PagerDuty pages"
```

---

### Task 5: Add power management, display wake, and alarm audio

**Files:**
- Create: `HatomPager/System/SystemSleepAssertion.swift`
- Create: `HatomPager/System/DisplayWakeService.swift`
- Create: `HatomPager/Audio/AlarmPlayer.swift`
- Create: `HatomPager/Resources/alarm.wav`

**Interfaces:**
- Produces: `SystemSleepAssertion.acquire/release`
- Produces: `DisplayWakeService.wakeDisplays`
- Produces: `AlarmPlayer.start/stop`

- [ ] **Step 1: Prevent system sleep without blocking display sleep**

Create `HatomPager/System/SystemSleepAssertion.swift`:

```swift
import Foundation
import IOKit.pwr_mgt

final class SystemSleepAssertion {
    private var assertionID: IOPMAssertionID = 0

    var isActive: Bool { assertionID != 0 }

    @discardableResult
    func acquire() -> Bool {
        guard !isActive else { return true }
        let result = IOPMAssertionCreateWithName(
            kIOPMAssertionTypePreventUserIdleSystemSleep as CFString,
            IOPMAssertionLevel(kIOPMAssertionLevelOn),
            "Hatom Pager is armed" as CFString,
            &assertionID
        )
        if result != kIOReturnSuccess { assertionID = 0 }
        return result == kIOReturnSuccess
    }

    func release() {
        guard isActive else { return }
        IOPMAssertionRelease(assertionID)
        assertionID = 0
    }

    deinit { release() }
}
```

Do not use a display-sleep prevention assertion.

- [ ] **Step 2: Wake displays for each new page**

Create `HatomPager/System/DisplayWakeService.swift`:

```swift
import Foundation
import IOKit.pwr_mgt

final class DisplayWakeService {
    private var assertionID: IOPMAssertionID = 0

    func wakeDisplays() {
        IOPMAssertionDeclareUserActivity(
            "Hatom Pager received a page" as CFString,
            kIOPMUserActiveLocal,
            &assertionID
        )
    }
}
```

- [ ] **Step 3: Generate a deterministic bundled alarm**

Create a two-second mono WAV without adding a generator script:

```bash
python3 - <<'PY'
import math, struct, wave
rate = 44100
duration = 2.0
with wave.open("HatomPager/Resources/alarm.wav", "wb") as out:
    out.setnchannels(1)
    out.setsampwidth(2)
    out.setframerate(rate)
    frames = []
    for i in range(int(rate * duration)):
        t = i / rate
        active = (t % 0.5) < 0.32
        frequency = 880 if int(t / 0.5) % 2 == 0 else 660
        sample = int(0.45 * 32767 * math.sin(2 * math.pi * frequency * t)) if active else 0
        frames.append(struct.pack("<h", sample))
    out.writeframes(b"".join(frames))
PY
```

- [ ] **Step 4: Loop the alarm while pages remain**

Create `HatomPager/Audio/AlarmPlayer.swift`:

```swift
import AVFoundation
import Foundation

@MainActor
final class AlarmPlayer {
    private var player: AVAudioPlayer?

    func start() {
        guard player?.isPlaying != true else { return }
        guard let url = Bundle.main.url(forResource: "alarm", withExtension: "wav")
        else { return }
        do {
            let player = try AVAudioPlayer(contentsOf: url)
            player.numberOfLoops = -1
            player.prepareToPlay()
            player.play()
            self.player = player
        } catch {
            self.player = nil
        }
    }

    func stop() {
        player?.stop()
        player = nil
    }
}
```

- [ ] **Step 5: Build and commit**

```bash
xcodegen generate
xcodebuild -project HatomPager.xcodeproj -scheme HatomPager \
  -configuration Debug -derivedDataPath .build CODE_SIGNING_ALLOWED=NO build
git add HatomPager HatomPager.xcodeproj
git commit -m "feat: wake displays and sound page alarms"
```

---

### Task 6: Add the multi-display page overlay

**Files:**
- Create: `HatomPager/Presentation/PageOverlayPanel.swift`
- Create: `HatomPager/Presentation/PageOverlayView.swift`
- Create: `HatomPager/Presentation/OverlayCoordinator.swift`
- Create: `HatomPager/System/SessionActivityMonitor.swift`

**Interfaces:**
- Produces: `OverlayCoordinator.present/dismiss/setSessionActive`
- Consumes: current `PagePayload`, queue count, acknowledgement closure

- [ ] **Step 1: Create a key-capable borderless panel**

Create `HatomPager/Presentation/PageOverlayPanel.swift`:

```swift
import AppKit

final class PageOverlayPanel: NSPanel {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
}
```

- [ ] **Step 2: Create the SwiftUI overlay content**

Create `HatomPager/Presentation/PageOverlayView.swift`:

```swift
import SwiftUI

struct PageOverlayView: View {
    let page: PagePayload
    let queueCount: Int
    let isAcknowledging: Bool
    let acknowledge: () -> Void

    var body: some View {
        ZStack {
            Color.black.opacity(0.94).ignoresSafeArea()
            VStack(spacing: 24) {
                Text(page.emoji)
                    .font(.system(size: 180))
                    .minimumScaleFactor(0.4)
                if !page.message.isEmpty {
                    Text(page.message)
                        .font(.system(size: 42, weight: .semibold))
                        .multilineTextAlignment(.center)
                }
                Text("From \(page.callerEmail)")
                    .font(.title3)
                    .foregroundStyle(.secondary)
                if queueCount > 1 {
                    Text("\(queueCount) active pages")
                        .foregroundStyle(.secondary)
                }
                Button(isAcknowledging ? "Acknowledging…" : "Acknowledge") {
                    acknowledge()
                }
                .keyboardShortcut(.defaultAction)
                .controlSize(.large)
                .disabled(isAcknowledging)
            }
            .padding(60)
        }
        .foregroundStyle(.white)
    }
}
```

- [ ] **Step 3: Coordinate one panel per screen**

Create `HatomPager/Presentation/OverlayCoordinator.swift`:

```swift
import AppKit
import SwiftUI

@MainActor
final class OverlayCoordinator {
    private var panels: [PageOverlayPanel] = []
    private var current: (PagePayload, Int, Bool, () -> Void)?
    private var sessionActive = true

    init() {
        NotificationCenter.default.addObserver(
            forName: NSApplication.didChangeScreenParametersNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in self?.rebuild() }
        }
    }

    func present(
        page: PagePayload,
        queueCount: Int,
        isAcknowledging: Bool,
        acknowledge: @escaping () -> Void
    ) {
        current = (page, queueCount, isAcknowledging, acknowledge)
        rebuild()
    }

    func dismiss() {
        current = nil
        panels.forEach { $0.orderOut(nil) }
        panels.removeAll()
    }

    func setSessionActive(_ active: Bool) {
        sessionActive = active
        if active { rebuild() }
        else { panels.forEach { $0.orderOut(nil) } }
    }

    private func rebuild() {
        panels.forEach { $0.orderOut(nil) }
        panels.removeAll()
        guard sessionActive, let current else { return }

        for screen in NSScreen.screens {
            let panel = PageOverlayPanel(
                contentRect: screen.frame,
                styleMask: [.borderless, .fullSizeContentView],
                backing: .buffered,
                defer: false
            )
            panel.level = .screenSaver
            panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]
            panel.backgroundColor = .black
            panel.isOpaque = true
            panel.contentView = NSHostingView(
                rootView: PageOverlayView(
                    page: current.0,
                    queueCount: current.1,
                    isAcknowledging: current.2,
                    acknowledge: current.3
                )
            )
            panel.setFrame(screen.frame, display: true)
            panel.orderFrontRegardless()
            panels.append(panel)
        }
        panels.first?.makeKey()
    }
}
```

- [ ] **Step 4: Respect public session activity notifications**

Create `HatomPager/System/SessionActivityMonitor.swift`:

```swift
import AppKit

@MainActor
final class SessionActivityMonitor {
    private var observers: [NSObjectProtocol] = []

    init(onChange: @escaping @MainActor (Bool) -> Void) {
        let center = NSWorkspace.shared.notificationCenter
        observers.append(center.addObserver(
            forName: NSWorkspace.sessionDidResignActiveNotification,
            object: nil,
            queue: .main
        ) { _ in Task { @MainActor in onChange(false) } })
        observers.append(center.addObserver(
            forName: NSWorkspace.sessionDidBecomeActiveNotification,
            object: nil,
            queue: .main
        ) { _ in Task { @MainActor in onChange(true) } })
    }

    deinit {
        let center = NSWorkspace.shared.notificationCenter
        observers.forEach(center.removeObserver)
    }
}
```

The secure login window remains above the app. Do not add private CoreGraphics
session keys or private distributed notification names.

- [ ] **Step 5: Build and commit**

```bash
xcodegen generate
xcodebuild -project HatomPager.xcodeproj -scheme HatomPager \
  -configuration Debug -derivedDataPath .build CODE_SIGNING_ALLOWED=NO build
git add HatomPager HatomPager.xcodeproj
git commit -m "feat: present pages across Mac displays"
```

---

### Task 7: Wire arming, queueing, polling, audio, and acknowledgement

**Files:**
- Modify: `HatomPager/App/AppState.swift`
- Modify: `HatomPager/App/AppDelegate.swift`
- Modify: `HatomPager/App/HatomPagerApp.swift`
- Modify: `HatomPager/UI/MenuBarView.swift`

**Interfaces:**
- Produces: the complete app state machine
- Consumes: all modules from Tasks 2–6

- [ ] **Step 1: Replace the temporary app state with the full state machine**

Replace `HatomPager/App/AppState.swift` with:

```swift
import Combine
import Foundation

@MainActor
final class AppState: ObservableObject {
    static let shared = AppState()

    @Published private(set) var isArmed = false
    @Published private(set) var isConfigured = false
    @Published private(set) var connectivity: ConnectivityState = .disconnected
    @Published private(set) var pages: [PagePayload] = []
    @Published private(set) var acknowledgingIncidentID: String?

    private let keychain = KeychainStore()
    private let sleepAssertion = SystemSleepAssertion()
    private let displayWake = DisplayWakeService()
    private let alarm = AlarmPlayer()
    private let overlay = OverlayCoordinator()
    private var pollEngine: PollEngine?
    private var sessionMonitor: SessionActivityMonitor?
    private var client: PagerDutyClient?
    private var acknowledgementTask: Task<Void, Never>?

    var statusText: String {
        if !isConfigured { return "Setup required" }
        if !isArmed { return "Disarmed" }
        if !pages.isEmpty {
            return pages.count == 1 ? "1 active page" : "\(pages.count) active pages"
        }
        switch connectivity {
        case .disconnected:
            return "Connecting…"
        case .connected:
            return "Armed"
        case .backingOff(let seconds):
            return "Retrying in \(seconds)s"
        }
    }

    var menuBarSymbol: String {
        if !isArmed { return "bell.slash" }
        if !pages.isEmpty { return "bell.badge.fill" }
        if case .backingOff = connectivity { return "wifi.exclamationmark" }
        return "bell.fill"
    }

    private init() {
        reloadConfiguration()
        sessionMonitor = SessionActivityMonitor { [weak self] active in
            guard let self else { return }
            self.overlay.setSessionActive(active)
            if active, !self.pages.isEmpty { self.render() }
        }
    }

    func reloadConfiguration() {
        if isArmed { setArmed(false) }
        let configuration = PagerDutyConfiguration.load()
        let token = try? keychain.loadToken()
        isConfigured = configuration.isComplete && !(token ?? "").isEmpty
    }

    func setArmed(_ armed: Bool) {
        guard armed != isArmed else { return }
        if armed {
            guard isConfigured,
                  let configuredClient = makeClient(),
                  sleepAssertion.acquire()
            else { return }
            client = configuredClient
            isArmed = true
            startPolling(client: configuredClient)
        } else {
            isArmed = false
            acknowledgementTask?.cancel()
            acknowledgementTask = nil
            acknowledgingIncidentID = nil
            pollEngine?.stop()
            pollEngine = nil
            client = nil
            sleepAssertion.release()
            pages.removeAll()
            alarm.stop()
            overlay.dismiss()
            connectivity = .disconnected
        }
    }

    func acknowledgeCurrentPage() {
        guard let page = pages.first,
              acknowledgingIncidentID == nil,
              let client
        else { return }

        acknowledgingIncidentID = page.id
        if pages.count == 1 { alarm.stop() }
        render()
        acknowledgementTask = Task { [weak self] in
            guard let self else { return }
            var attempt = 0
            while !Task.isCancelled {
                do {
                    try await client.acknowledge(incidentID: page.id)
                    self.pages.removeAll { $0.id == page.id }
                    self.acknowledgingIncidentID = nil
                    self.acknowledgementTask = nil
                    if self.pages.isEmpty { self.alarm.stop() }
                    else { self.alarm.start() }
                    self.render()
                    return
                } catch {
                    attempt += 1
                    let delay = BackoffPolicy().delay(for: error, attempt: attempt)
                    try? await Task.sleep(
                        nanoseconds: UInt64(delay * 1_000_000_000)
                    )
                }
            }
        }
    }

    func shutdown() {
        acknowledgementTask?.cancel()
        acknowledgementTask = nil
        pollEngine?.stop()
        pollEngine = nil
        sleepAssertion.release()
        alarm.stop()
        overlay.dismiss()
        pages.removeAll()
        isArmed = false
        connectivity = .disconnected
    }

    private func makeClient() -> PagerDutyClient? {
        let configuration = PagerDutyConfiguration.load()
        guard configuration.isComplete,
              let token = try? keychain.loadToken(),
              !token.isEmpty
        else { return nil }
        return PagerDutyClient(
            token: token,
            fromEmail: configuration.fromEmail,
            serviceID: configuration.serviceID
        )
    }

    private func startPolling(client: PagerDutyClient) {
        let engine = PollEngine(
            client: client,
            onPage: { [weak self] page in self?.receive(page) },
            onDismissed: { [weak self] ids in self?.dismiss(ids) },
            onConnectivity: { [weak self] state in self?.connectivity = state }
        )
        pollEngine = engine
        engine.start()
    }

    private func receive(_ page: PagePayload) {
        guard !pages.contains(where: { $0.id == page.id }) else { return }
        pages.append(page)
        pages.sort { $0.createdAt > $1.createdAt }
        displayWake.wakeDisplays()
        alarm.start()
        render()
    }

    private func dismiss(_ incidentIDs: Set<String>) {
        if let acknowledgingIncidentID,
           incidentIDs.contains(acknowledgingIncidentID) {
            acknowledgementTask?.cancel()
            acknowledgementTask = nil
            self.acknowledgingIncidentID = nil
        }
        pages.removeAll { incidentIDs.contains($0.id) }
        if pages.isEmpty { alarm.stop() }
        render()
    }

    private func render() {
        guard let page = pages.first else {
            overlay.dismiss()
            return
        }
        overlay.present(
            page: page,
            queueCount: pages.count,
            isAcknowledging: acknowledgingIncidentID == page.id,
            acknowledge: { [weak self] in self?.acknowledgeCurrentPage() }
        )
    }
}
```

Keep `AppDelegate.applicationWillTerminate` calling
`AppState.shared.shutdown()`.

- [ ] **Step 2: Render useful menu-bar state**

In `HatomPagerApp`, replace the label's `systemImage` expression with:

```swift
Label("Hatom Pager", systemImage: state.menuBarSymbol)
```

Replace `MenuBarView` with:

```swift
import SwiftUI

struct MenuBarView: View {
    @EnvironmentObject private var state: AppState

    var body: some View {
        Text(state.statusText)
        if !state.pages.isEmpty {
            Button("Acknowledge current page") {
                state.acknowledgeCurrentPage()
            }
            .disabled(state.acknowledgingIncidentID != nil)
        }
        Button(state.isArmed ? "Disarm" : "Arm") {
            state.setArmed(!state.isArmed)
        }
        .disabled(!state.isConfigured && !state.isArmed)
        Divider()
        Button("Settings…") {
            NSApplication.shared.sendAction(
                Selector(("showSettingsWindow:")),
                to: nil,
                from: nil
            )
        }
        Button("Quit") {
            NSApplication.shared.terminate(nil)
        }
    }
}
```

This displays no credentials and derives all icon/status states from
`AppState`.

- [ ] **Step 3: Build and commit**

```bash
xcodegen generate
xcodebuild -project HatomPager.xcodeproj -scheme HatomPager \
  -configuration Debug -derivedDataPath .build CODE_SIGNING_ALLOWED=NO build
git add HatomPager HatomPager.xcodeproj
git commit -m "feat: connect PagerDuty paging lifecycle"
```

---

### Task 8: Sign, install, and manually verify the complete receiver

**Files:**
- Modify only project signing settings if the local Apple development team
  requires a committed team identifier; otherwise no repository files

**Interfaces:**
- Consumes: PagerDuty service ID, REST user token, and user email
- Produces: installed always-on app in `/Applications/Hatom Pager.app`

- [ ] **Step 1: Create the PagerDuty user token**

In PagerDuty, create a **User Token REST API Key** for the intended responder.
Do not use a read-only key because the Mac must acknowledge incidents. Record
the Hatom Paging service ID and the same PagerDuty user's email.

- [ ] **Step 2: Configure local signing and archive**

Open `HatomPager.xcodeproj`, select an Apple development team for the
`HatomPager` target, keep bundle ID `im.hatom.pager`, and build Release. Copy
the resulting app to `/Applications/Hatom Pager.app`.

Launch it from `/Applications`, enter the service ID, user email, and REST
token in Settings, enable Launch at Login, save, and arm.

- [ ] **Step 3: Verify system and display behavior**

Manually verify:

1. Armed prevents system idle sleep while the display still sleeps.
2. Disarm immediately releases the system-sleep assertion.
3. A page wakes every connected display and starts looping audio.
4. A locked Mac plays audio and wakes its display without drawing over the
   secure login window; the overlay appears after unlock.
5. Connecting or disconnecting a display rebuilds the overlays.

- [ ] **Step 4: Verify PagerDuty state behavior**

Manually verify:

1. A web-triggered incident appears within one normal poll interval.
2. Mac acknowledgement changes the PagerDuty incident to `acknowledged` and
   stops iPhone escalation.
3. iPhone acknowledgement dismisses the Mac within one normal poll interval.
4. Two active incidents queue newest-first and audio continues until both are
   acknowledged.
5. Offline mode never falsely dismisses the current alarm.
6. Reconnection and rearming present every still-triggered incident.
7. HTTP `429` or a simulated transient failure shows backing-off state and
   eventually returns to five-second polling.
8. Quitting during a failed acknowledgement leaves the PagerDuty incident
   triggered; relaunch presents it again.

- [ ] **Step 5: Final build and repository check**

```bash
xcodegen generate
xcodebuild -project HatomPager.xcodeproj -scheme HatomPager \
  -configuration Release -derivedDataPath .build build
git status --short
git log --oneline --decorate -8
```

Expected: `** BUILD SUCCEEDED **`, no page data or PagerDuty token in the
repository, no test target, and no uncommitted generated-project drift.
