# Contributing a community Peekling

Thank you for making a little character for the Peekling community. This repository accepts complete, data-only Packs through pull requests.

Please read the [community guidelines](COMMUNITY_GUIDELINES.md) before you begin. If the character or its artwork rights need discussion, open a [Peekling proposal](https://github.com/peekling/awesome-peeklings/issues/new?template=peekling-proposal.yml) first.

## Start a Pack

You need Node.js 22.14 or later and npm 11.

Choose a short lowercase ID that is not already used here or listed in [`reserved-identifiers.json`](reserved-identifiers.json). A display name like `Tiny Sprout` might use `tiny-sprout` as its ID.

The published Peekling CLI can create a synthetic starting Pack:

```sh
npx --package @peekling/cli@0.1.0 peekling create ./tiny-sprout --name tiny-sprout
```

That command creates a development fixture. Replace the placeholder atlas, description, author, license, and provenance before submitting it.

Put the finished Pack in `peeklings/<id>`:

```text
peeklings/tiny-sprout/
  character.json
  atlas.png
  thumbnail.png
  README.md
  LICENSE
  RIGHTS.json
```

`NOTICE` is also required when the license or attribution record calls for it. Apache-2.0 Packs must include it.

## Meet the Pack boundary

Each accepted folder contains only the public Pack:

- `character.json` uses format 1, matches the folder ID, and declares the character version, license, metadata, states, movement directions, defaults, atlas geometry, and SHA-256 hashes.
- Every atlas referenced by the manifest is a PNG with alpha. A Pack may declare one to three densities from 1x, 2x, and 4x.
- `thumbnail.png` is a 64 by 64 pixel PNG.
- `README.md` introduces the character, credits the creator, and includes a `## License` section.
- `LICENSE` contains the full license text. We currently accept Apache-2.0, CC0-1.0, CC-BY-4.0, and CC-BY-SA-4.0.
- `RIGHTS.json` records the creator, artwork origin, source, license, rights statement, and generative-tool disclosure. Start from [`schemas/rights.example.json`](schemas/rights.example.json).

Do not add source files, design documents, scripts, HTML, SVG, archives, binaries, symlinks, or nested directories to a Pack folder. Keep source artwork in your own repository or portfolio and link it from `RIGHTS.json`.

The engine limits a Pack to 32 files and 8 MiB in total. Each atlas is limited to 4 MiB and 4096 pixels on either side. The manifest is limited to 64 KiB.

## Check the submission

Install the locked development tools, update the generated catalog and gallery, then run the same checks as GitHub Actions:

```sh
npm ci
npm run sync
npm run check
```

The checks use the published `@peekling/cli@0.1.0` validator. They also enforce the community file boundary, rights record, supported licenses, thumbnail dimensions, reserved IDs, generated catalog, documentation links, and repository policy.

## Open the pull request

Commit the Pack, `catalog.json`, and the generated README update. Open one pull request for one Peekling. Fill in the pull request template, include a visible preview, and keep the rights explanation consistent with `RIGHTS.json`.

The pull request check prevents a Pack submission from changing workflows, validation scripts, dependencies, or community policy in the same change. Maintainers review character fit and artwork rights after the automated checks pass.

Accepted community Packs remain in this repository under their declared license. They are not published as official `@peekling/pack-*` packages and do not become first-party characters.

## Update or remove a Pack

Use one pull request for one existing Pack. Explain the version change, rights update, or removal reason. A creator may request removal, but earlier licensed copies may remain available through Git history and lawful downstream redistribution.
