# Use Convex for application data and Clerk for authentication

Status: Accepted, superseding the no-backend portion of ADR 0001

SkillFlow will migrate application data from AsyncStorage to Convex and authentication to Clerk. Local development uses a Dockerized self-hosted Convex backend with persistent local data. Production uses a separate Convex Cloud deployment owned by Mann as project manager. Clerk development and production instances are also administrator-owned and remain blocked until Mann provides their public configuration and completes the required dashboard integration.

The migration must remain incremental: each record type has one documented authoritative store, local demo data remains deterministic until its Convex replacement is verified, and production must never silently fall back to local fake authentication. Convex and Clerk credentials are deployment-specific and are never committed or exposed through Expo public variables unless the value is explicitly public configuration.

ADR 0001 still governs payment, verification, earnings, and AI behavior: they remain clearly labeled simulations. This decision does not authorize real payment processing, external AI, production deployment, or access to administrator accounts.
