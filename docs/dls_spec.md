# 🌧️ Duckworth-Lewis-Stern (DLS) Method Specification

This document details the exact mathematical formulas, ICC resource decay parameters, par score calculations, and tiebreaker rules for the **Duckworth-Lewis-Stern (DLS)** method implemented in CricScore (`apps/frontend/src/utils/dlsUtils.ts`).

---

## 📐 1. The Core Concept: Resources Remaining ($R$)

The DLS method models a batting team's scoring capacity as a function of two fundamental resources:

1. **Overs Remaining** ($u$)
2. **Wickets Lost** ($w$)

The percentage of resources remaining ($R$) is defined by the exponential decay formula:

$$R(u, w) = R_0(w) \times \left( 1 - e^{-b(w) \cdot u} \right)$$

Where:

- $u$ = Overs remaining in the innings ($0 \le u \le 20$ for T20).
- $w$ = Number of wickets lost ($0 \le w \le 9$).
- $R_0(w)$ = Maximum resource available with $w$ wickets lost.
- $b(w)$ = Decay constant for $w$ wickets lost.

### Standard T20 Resource Table ($R_0$ and $b$ parameters):

| Wickets Lost ($w$) | $R_0(w)$ (%) | Decay Constant $b(w)$ | Resource at 20 overs ($u=20$) |
| :----------------: | :----------: | :-------------------: | :---------------------------: |
|       **0**        |    100.0%    |        0.0544         |            100.0%             |
|       **1**        |    93.4%     |        0.0558         |             91.2%             |
|       **2**        |    85.1%     |        0.0575         |             82.5%             |
|       **3**        |    74.9%     |        0.0598         |             72.1%             |
|       **4**        |    62.7%     |        0.0631         |             59.8%             |
|       **5**        |    48.5%     |        0.0682         |             45.8%             |
|       **6**        |    33.1%     |        0.0765         |             30.9%             |
|       **7**        |    18.7%     |        0.0910         |             17.3%             |
|       **8**        |     8.2%     |        0.1200         |             7.5%              |
|       **9**        |     2.1%     |        0.1800         |             1.9%              |

---

## 🎯 2. DLS Par Score Calculation (Rain / Interruption)

When rain or weather interruptions stop play during the 2nd innings, DLS calculates the **Par Score** (the target score team 2 needed to reach at that exact ball to tie the match).

### Formula for DLS Target Score:

1. **Calculate Team 1 Resource Used**: $R_1 = R(20, 0) = 100\%$
2. **Calculate Team 2 Resource Available**: $R_2 = R(\text{overs\_left}, \text{wickets\_lost})$
3. **Calculate DLS Par Score**:

$$\text{DLS Par Score} = \left\lfloor \text{Team 1 Score} \times \left( \frac{R_2}{R_1} \right) \right\rfloor$$

$$\text{DLS Target to Win} = \text{DLS Par Score} + 1$$

### Winner Decision Rules:

- If $\text{Team 2 Score} > \text{DLS Par Score} \implies$ **Team 2 Wins** by DLS Method.
- If $\text{Team 2 Score} < \text{DLS Par Score} \implies$ **Team 1 Wins** by DLS Method.
- If $\text{Team 2 Score} == \text{DLS Par Score} \implies$ **Match Tied** by DLS Method.

---

## 💡 3. Step-by-Step Worked Example

**Scenario**: Team 1 scored **160/6** in 20 overs.
Team 2 is chasing in the 2nd innings. Rain stops play at **10.0 overs** (10 overs left, $u=10$), and Team 2 is at **75/2** (2 wickets down, $w=2$).

1. **Team 1 Resource ($R_1$)**: $100\%$
2. **Team 2 Resource Remaining ($R_2$)**:
   $$R(10, 2) = 85.1 \times \left( 1 - e^{-0.0575 \times 10} \right) \approx 37.2\%$$
   Since Team 2 already used $82.5\% - 37.2\% = 45.3\%$ of their resources.
3. **DLS Par Score**:
   $$\text{DLS Par Score} = \lfloor 160 \times 0.453 \rfloor = 72 \text{ runs}$$

4. **Result**:
   Team 2 is at **75/2**, which is higher than the DLS Par Score of **72**.
   **Team 2 is leading by 3 runs on DLS!** If the match is abandoned now, Team 2 wins.
