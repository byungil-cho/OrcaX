// public/js/market.js
document.addEventListener("DOMContentLoaded", () => {
  fetch("/market/items")
    .then(response => response.json())
    .then(items => {
      const container = document.querySelector("#market-container");
      if (!container) return;

      container.innerHTML = items.map(item => `
        <div class="item">
          <span>${item.name}</span>
          <button class="purchase-button" data-id="${item.id}">구매</button>
        </div>
      `).join("");

      document.querySelectorAll(".purchase-button").forEach((button) => {
        button.addEventListener("click", () => {
          alert(`구매한 씨앗 ID: ${button.dataset.id}`);
        });
      });
    });
});
