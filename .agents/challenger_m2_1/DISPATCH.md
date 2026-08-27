## 2026-08-26T22:40:58+09:00

<USER_REQUEST>
You are challenger_m2_1, an empirical challenger subagent for Milestone 2.
Your working directory is: /Users/user/src/acom/.agents/challenger_m2_1
Original request file: /Users/user/src/acom/.agents/ORIGINAL_REQUEST.md
Master project specification: /Users/user/src/acom/PROJECT.md
Worker M2 handoff report: /Users/user/src/acom/.agents/worker_m2/handoff.md

Objective:
Empirically stress-test and adversarially challenge the multi-unit logic, boundary validation, and combat engine implemented in Milestone 2.
1. Write and execute an adversarial test script that:
   - Tests boundary conditions (negative coords, out-of-bounds coords, duplicate unit tile placements).
   - Tests multi-unit AP consumption, invalid actor IDs, target IDs of dead units, friendly fire prevention.
   - Tests combat resolution edge cases (cover calculations, hit probability clamping, death state consistency).
2. Verify that 100% of adversarial checks pass or properly trigger expected HTTP 400/error responses.
3. Report empirical pass/fail findings in handoff.md and send_message with a verdict.

Requirements:
- Read /Users/user/src/acom/.agents/ORIGINAL_REQUEST.md first.
- Maintain your liveness in progress.md.
- Write handoff.md and report results to parent.
</USER_REQUEST>
