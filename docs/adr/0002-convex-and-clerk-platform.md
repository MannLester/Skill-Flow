# Use Convex for application data and Clerk for authentication

Status: Accepted, amended 2026-08-26, superseding the no-backend portion of ADR 0001

SkillFlow stores application data in Convex and authenticates with Clerk. Primary human development and Expo Go testing use Mann's Convex Cloud development deployment with the Clerk development instance. Production uses the separate production deployment and Clerk production instance owned by Mann as project manager. A self-hosted deployment may remain as isolated infrastructure tooling, but it is not required by Expo Go, client builds, or the distributed application architecture.

Convex is now authoritative for authenticated application records. The former AsyncStorage store remains only as a Jest compatibility adapter and is not imported by production screens; obsolete device keys are removed after cloud profile establishment. Production never silently falls back to local fake authentication. Convex and Clerk configuration is deployment-specific. Development uses `cloud-development` with a Convex development URL and Clerk `pk_test_` publishable key; production uses `cloud` with the production URL and `pk_live_` key. Credentials are never committed or exposed through Expo public variables unless the value is explicitly public configuration.

ADR 0001 still governs payment, verification, earnings, and AI behavior: they remain clearly labeled simulations. This decision does not authorize real payment processing, external AI, production deployment, or access to administrator accounts.
