# Security policy

Community Packs are treated as untrusted data. Repository checks reject scripts, executable file types, symlinks, nested Pack content, undeclared files, invalid paths, oversized resources, and atlas hashes or geometry that do not match the manifest.

These checks reduce risk. They are not a guarantee that a Pack is safe, original, or suitable for every environment. Consumers should pin a reviewed commit, keep the Peekling runtime current, review the Pack license, and serve files with an appropriate Content Security Policy.

## Report a vulnerability

Use [GitHub's private vulnerability reporting](https://github.com/peekling/awesome-peeklings/security/advisories/new) for a security issue in this repository, its checks, or an accepted Pack. Include the affected Pack ID, commit, impact, and a minimal reproduction when possible.

Do not open a public issue for an unpatched vulnerability or include another person's private information. Rights and conduct concerns follow the reporting guidance in the [community guidelines](COMMUNITY_GUIDELINES.md).
