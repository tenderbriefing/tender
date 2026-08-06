Security Policy

TenderBriefing is committed to protecting the confidentiality, integrity and availability of its platform, users and procurement-related information.

We welcome responsible security research and encourage researchers, customers and partners to report suspected vulnerabilities privately so that they can be investigated and remediated safely.

Supported Versions

TenderBriefing operates as a continuously delivered cloud service. Security updates are applied to the current production release rather than maintained across multiple public software versions.

Release	Security Support
Current production release	Supported
Current main branch	Supported after deployment and production verification
Active release candidate	Supported during testing
Previous production revision retained for rollback	Critical fixes only
Archived branches, forks and superseded releases	Not supported
Local development or unofficial deployments	Not supported

Only the production service hosted and controlled by TenderBriefing should be considered an officially supported deployment.

Reporting a Vulnerability

Do not report suspected security vulnerabilities through public GitHub issues, pull requests, discussion boards, social media or public support channels.

Report vulnerabilities privately by email to:

info@tenderbriefing.co.za

Use the subject line:

Security Vulnerability Report — TenderBriefing

Where possible, include:

* A clear description of the vulnerability
* The affected page, API route, function or service
* The date and time the issue was observed
* Steps required to reproduce the issue
* The potential security or business impact
* Screenshots, logs or proof-of-concept material
* The account role used during testing
* Whether the issue affects production, testing or development
* Any suggested remediation
* Your preferred contact details

Do not include passwords, private keys, access tokens, financial credentials, identity documents or unnecessary personal information in the report.

Response Targets

TenderBriefing will make reasonable efforts to follow these response targets:

Stage	Target
Initial acknowledgement	Within 2 business days
Initial assessment and severity classification	Within 5 business days
Critical vulnerability containment	As soon as reasonably possible
Progress updates for accepted reports	At least every 7 business days
Final resolution or remediation plan	Based on severity and technical complexity

These targets are operational objectives and may vary depending on the complexity, severity and reproducibility of the report.

Severity Classification

Reported vulnerabilities will generally be assessed using the following severity levels.

Critical

Examples include:

* Authentication bypass
* Founder or administrator account takeover
* Remote code execution
* Exposure of production secrets
* Unauthorised access to payment credentials
* Mass disclosure of confidential user information
* Ability to modify payments, roles or security controls
* Cross-tenant access affecting multiple organisations

High

Examples include:

* Privilege escalation
* IDOR affecting sensitive records
* Unauthorised access to tender documents, SME records or Youth Agent information
* Payment verification bypass
* Persistent cross-site scripting
* Significant Firestore or Storage rule failures
* Ability to impersonate another user

Medium

Examples include:

* Limited information disclosure
* Missing authorisation on a low-impact operation
* Stored or reflected injection with constrained impact
* Rate-limit bypass
* Security misconfiguration with limited exposure

Low

Examples include:

* Minor security-header weaknesses
* Low-impact information exposure
* Issues requiring unrealistic conditions
* Best-practice improvements without immediate exploitability

Final severity classification remains at TenderBriefing’s discretion and will consider exploitability, affected users, data sensitivity and business impact.

Safe-Harbour Expectations

TenderBriefing will not pursue legal action against researchers who:

* Act in good faith
* Report vulnerabilities privately
* Avoid accessing or modifying information beyond what is necessary to demonstrate the issue
* Avoid disrupting production services
* Avoid degrading platform availability
* Do not retain, publish or distribute confidential information
* Give TenderBriefing reasonable time to investigate and remediate the issue
* Comply with applicable laws
* Stop testing when requested

This policy does not authorise access to third-party systems, supplier platforms, government systems, payment-provider infrastructure or services not controlled by TenderBriefing.

Prohibited Testing

Do not perform:

* Denial-of-service or distributed denial-of-service testing
* Automated high-volume scanning against production
* Credential stuffing
* Password spraying
* Brute-force attacks
* Social engineering
* Phishing
* Physical security testing
* Malware deployment
* Destructive database testing
* Modification or deletion of user records
* Testing involving real payment fraud
* Access to another user’s private files or messages
* Extraction of large data sets
* Testing against PayFast, Resend, Google, Firebase or other third-party infrastructure without their permission

Do not create excessive SME registrations, Youth Agent accounts, attendance requests, payments, notifications or tender records as part of testing.

Data Handling

When demonstrating a vulnerability:

* Use your own test account wherever possible
* Access the minimum amount of information necessary
* Do not download or retain private user information
* Redact personal and confidential information from screenshots
* Delete locally stored evidence after the issue is resolved
* Notify TenderBriefing immediately if sensitive information is unintentionally accessed

TenderBriefing may request confirmation that sensitive information has been securely deleted.

Eligible Vulnerabilities

Examples of vulnerabilities that may be eligible for investigation include:

* Authentication and session-management failures
* Role or privilege escalation
* IDOR and cross-tenant access
* Firestore or Storage rule bypass
* Unauthorised access to SME, Youth Agent, founder or administrator records
* Payment-verification vulnerabilities
* PayFast webhook validation failures
* Sensitive information disclosure
* Remote code execution
* Server-side request forgery
* SQL, NoSQL or command injection
* Cross-site scripting with demonstrable impact
* Cross-site request forgery affecting sensitive operations
* File-upload vulnerabilities
* Secret exposure
* Security-control bypass
* Vulnerabilities affecting tender ingestion, automation or notification integrity

Generally Ineligible Reports

The following are generally not considered security vulnerabilities unless they demonstrate material impact:

* Missing security headers without a working exploit
* Self-XSS
* Clickjacking on pages without sensitive actions
* Rate-limit observations without meaningful abuse
* Public information already intentionally disclosed
* Username or email enumeration with no further impact
* Issues affecting unsupported browsers
* Vulnerabilities requiring compromised user devices
* Social-engineering scenarios
* Reports generated only by automated scanners
* Dependency-version reports without an exploitable path
* Theoretical findings without reproducible evidence
* UI or usability defects
* Spam or notification-volume complaints
* Issues in third-party services outside TenderBriefing’s control

Disclosure Process

When a vulnerability is accepted, TenderBriefing may:

1. Confirm the issue and assign a severity.
2. Implement containment or mitigation.
3. Develop and test a permanent fix.
4. Deploy the fix through the approved release process.
5. Verify the exact production revision.
6. Update the reporter on material progress.
7. Publish a security advisory where appropriate.

Do not publicly disclose the vulnerability before TenderBriefing confirms that remediation is complete.

Where a report is declined, TenderBriefing will endeavour to provide a concise explanation.

Recognition and Rewards

TenderBriefing does not currently operate a guaranteed paid bug-bounty programme.

Recognition, acknowledgement or discretionary rewards may be considered for high-quality reports, but must not be assumed or demanded.

Any recognition will depend on:

* Severity
* Originality
* Reproducibility
* Report quality
* Responsible conduct
* Business impact

Third-Party Services

TenderBriefing uses third-party technology and service providers, which may include:

* Google Cloud
* Firebase
* GitHub
* PayFast
* Resend
* OpenAI

Vulnerabilities affecting these services should also be reported through the relevant provider’s official security process.

Do not test third-party systems using TenderBriefing credentials or infrastructure without explicit authorisation.

Confidentiality

All vulnerability reports and related communications should be treated as confidential until TenderBriefing confirms that disclosure is appropriate.

TenderBriefing may share report details with relevant service providers, legal advisers, insurers or technical specialists where required for investigation and remediation.

Policy Updates

This policy may be updated as TenderBriefing’s platform, infrastructure and security processes evolve.

The latest version maintained in the official TenderBriefing repository will be considered authoritative.
