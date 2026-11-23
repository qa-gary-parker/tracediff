# tracediff

Diff a passing and a failing Playwright `trace.zip`. Find the first step where the runs split, and what
changed in the network and console around it.

On npm as `pw-tracediff`; the CLI command is `tracediff`.

Overview and FAQ: [garyparker.dev/projects/tracediff](https://garyparker.dev/projects/tracediff). Videos: [youtube.com/@garyparkerdev](https://www.youtube.com/@garyparkerdev)

## The problem

A test fails in CI and passed an hour ago. The trace viewer shows one run at a time, so you compare two
traces by hand: scrolling both action lists, then both network tabs. `tracediff` does that comparison and
prints the result.

## Install

```sh
npm install --save-dev pw-tracediff
npx tracediff pass.zip fail.zip
```

Requires Node 20 or later. The traces must come from `@playwright/test` (they contain a `test.trace`
entry). Record them with `trace: 'on'` or `'retain-on-failure'`; the files are at
`test-results/<test>/trace.zip`.

## Usage

```sh
tracediff pass.zip fail.zip           # Markdown report
tracediff pass.zip fail.zip --json    # machine-readable report
```

| Exit code | Meaning |
| --- | --- |
| 0 | The runs match |
| 1 | The runs differ |
| 2 | Usage error or unreadable file |

The report has four sections. Empty sections are left out.

- **First divergence.** Actions are the test's own steps (`Navigate`, `Fill`, `Click`, `Expect`, `test.step`),
  compared in order by title and selector. The first step that differs is reported, with the error the
  failing run raised. A step also diverges when it errors in only one run.
- **Network.** Requests are matched by method and URL, counting repeats. Reports requests missing from or
  extra in the failing run, and status changes.
- **Console errors.** `console.error` messages that appear in only one run.
- **Duration outliers.** Matched actions where one run took at least 3x as long and at least 200 ms longer.

## Example

Output for the traces in `test/fixtures`. In the failing run the config request returns 500, the page
logs an error and retries, and the test clicks a selector that does not exist.

```text
# tracediff

## First divergence

- Step 4: pass ran `Click locator('#save')`, fail ran `Click locator('#save-btn')`
- Fail error: TimeoutError: locator.click: Timeout 1000ms exceeded.

## Network

- Missing in fail: `GET https://app.tracediff.test/api/ping` (200)
- Missing in fail: `POST https://app.tracediff.test/api/save` (200)
- Extra in fail: `GET https://app.tracediff.test/api/retry` (200)
- Status changed: `GET https://app.tracediff.test/api/config` 200 -> 500

## Console errors

- Only in fail: Failed to load resource: the server responded with a status of 500 (Internal Server Error)
- Only in fail: config failed: 500

## Duration outliers

- `Wait for timeout`: 51 ms -> 610 ms
```

## Limits

- Only `@playwright/test` traces are read. Traces from the library API alone have no `test.trace`.
- Actions are compared by position. After the first divergence the later steps are not re-aligned, so
  only the first divergence is reported.
- Network requests are matched by method and full URL. A URL with a changing query string or ID shows
  as one missing and one extra request.
- Only `console.error` messages are compared, by exact text.
- Duration outliers are reported but do not affect the exit code, because timing varies between runs.
- Request and response bodies, headers and DOM snapshots are not compared.

## Fixtures

`test/fixtures/pass.zip` and `fail.zip` come from real Playwright runs. Regenerate them with
`npx playwright install chromium && npm run fixtures:gen`.

## License

MIT
