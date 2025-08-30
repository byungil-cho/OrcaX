// pung.module.js

export function calculatePungResult({ grade, cornCount, loanStatus }) {
  const results = [];
  const baseToken = 1000;
  let image = "corn-yellow.png";
  let penaltyRate = 0;

  // 옥수수 색상 및 공제율 결정
  if (loanStatus === "unpaid") {
    image = "corn-black.png";
    penaltyRate = 0.3;
  } else if (loanStatus === "loan") {
    image = "corn-red.png";
    penaltyRate = 0.3;
  } else {
    image = "corn-yellow.png";
  }

  for (let i = 0; i < cornCount; i++) {
    const token = baseToken;
    const afterTax = Math.floor(token * (1 - penaltyRate));
    const dailyLoss = loanStatus === "unpaid" ? Math.floor(afterTax * 0.05) : 0;

    results.push({
      token,
      grade,
      afterTax,
      image,
      dailyLoss
    });
  }

  return results;
}
