# Confluence corpus fidelity report

Source: `reports/synthetic-bodycontent.csv`
Generated: 2026-08-05T03:26:31.143Z

## Round-trip gate

Each page is converted from storage-format XHTML to markdown, then checked
for a fixed point: `serialize(parse(x))` must be stable under repetition.

| Metric | Value |
|---|---|
| Pages | 1361 |
| Fixed point after one pass | 1361 (100.00%) |
| Failed the gate | 0 (0.00%) |
| Conversion errors | 0 |

## Text retention

Fraction of the source page's visible words still present in the markdown.
This is the measure that catches a dropped macro body — the round-trip check
alone would call an empty page a perfect fixed point.

| Percentile | Retention |
|---|---|
| Mean | 99.92% |
| p50 | 100.00% |
| p10 | 99.61% |
| p05 | 99.35% |
| p01 | 98.75% |
| min | 97.96% |

Attachment references seen: 4929

## Worst pages by retention

| Page id | Bytes | Retention | Fixed point | Notes |
|---|---|---|---|---|
| page-1021 | 4214 | 97.96% | yes | attachment:zagtrader-12.png, attachment:collateral-56.png, attachment:oms-97.png, attachment:order-48.png |
| page-0883 | 4518 | 98.26% | yes | attachment:collateral-compliance.png, attachment:mandate-44.png, attachment:audit-25.png, attachment:auction-21.png |
| page-0581 | 4734 | 98.37% | yes | attachment:webhook-1.png, attachment:attestation-51.png, attachment:margin-16.png |
| page-0822 | 5118 | 98.45% | yes | attachment:custody-56.png, attachment:session-44.png, attachment:heartbeat-4.png, attachment:disclosure-10.png |
| page-0429 | 5680 | 98.50% | yes | attachment:settlement-89.png, attachment:auction-18.png, attachment:retry-20.png, attachment:fix.pdf |
| page-0606 | 4965 | 98.50% | yes | attachment:fix-69.png, attachment:clearing-47.png, attachment:depositary-83.png |
| page-0111 | 4824 | 98.51% | yes | attachment:heartbeat-65.png, attachment:collateral-97.png, attachment:oms-59.png |
| page-0876 | 4805 | 98.53% | yes | attachment:broker-40.png, attachment:trail-70.png, attachment:retry-19.png |
| page-0840 | 4461 | 98.54% | yes | attachment:routing-80.png, attachment:idempotent-34.png, attachment:session-26.png |
| page-1038 | 5105 | 98.60% | yes | attachment:attestation-72.png, attachment:depositary-98.png, attachment:retry-91.png, attachment:routing-58.png |
| page-0256 | 5535 | 98.61% | yes | attachment:trade-98.png, attachment:reconciliation-28.png, attachment:market-91.png |
| page-0025 | 4487 | 98.70% | yes | attachment:close-67.png, attachment:broker-69.png, attachment:escrow-42.png, attachment:trail-8.png |
| page-1347 | 4942 | 98.73% | yes | attachment:throttle-49.png, attachment:venue-84.png, attachment:idempotent-25.png, attachment:backoff-61.png |
| page-0169 | 5974 | 98.75% | yes | attachment:auction-59.png, attachment:latency-20.png, attachment:margin-79.png, attachment:webhook-61.png |
| page-1062 | 4924 | 98.81% | yes | attachment:kyc-37.png, attachment:latency-53.png, attachment:audit-7.png, attachment:suitability.pdf |
| page-0255 | 4893 | 98.82% | yes | attachment:backoff-20.png, attachment:kyc-46.png, attachment:custody-13.png, attachment:payout-78.png |
| page-0517 | 6210 | 98.84% | yes | dropped:toc, attachment:ledger-67.png, attachment:routing-14.png |
| page-0568 | 6836 | 98.87% | yes | attachment:custody-45.png, attachment:escrow-1.png, attachment:venue-62.png |
| page-0618 | 4987 | 98.91% | yes | attachment:kyc-34.png, attachment:trade-34.png, attachment:onboarding-23.png, attachment:webhook-41.png |
| page-0376 | 6608 | 98.94% | yes | attachment:latency-95.png, attachment:webhook-4.png, attachment:retry-98.png |

## Verdict

Round-trip failures are 0.00%, within the 2% threshold in the brief.
