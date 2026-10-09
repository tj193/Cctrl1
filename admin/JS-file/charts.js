(() => {
  "use strict";
  const instances = new Map();
  const colors = ["#146ff5", "#15b7a4", "#f08a4b", "#8069e6"];
  function draw(id, type, labels, datasets, options = {}) {
    instances.get(id)?.destroy();
    instances.delete(id);
    const canvas = document.getElementById(id);
    if (!canvas) return false;
    canvas.parentElement.querySelector(".chart-fallback")?.remove();
    canvas.parentElement.classList.toggle("is-empty", !labels.length);
    if (!window.Chart || !labels.length) {
      canvas.hidden = true;
      if (labels.length) {
        const list = document.createElement("ul");
        list.className = "chart-fallback";
        labels.forEach((label, index) => {
          const item = document.createElement("li");
          const name = document.createElement("span");
          name.textContent = label;
          const value = document.createElement("strong");
          value.textContent = datasets
            .map((set) => `${set.label}: ${set.data[index]}`)
            .join(" · ");
          item.append(name, value);
          list.append(item);
        });
        canvas.after(list);
      }
      return false;
    }
    canvas.hidden = false;
    instances.set(
      id,
      new Chart(canvas, {
        type,
        data: {
          labels,
          datasets: datasets.map((set, index) => ({
            ...set,
            backgroundColor:
              set.backgroundColor || colors[index % colors.length],
            borderColor: set.borderColor || colors[index % colors.length],
            borderWidth: 2,
            borderRadius: type === "bar" ? 5 : undefined,
            tension: type === "line" ? 0.3 : undefined,
            fill: type === "line",
          })),
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? false
            : undefined,
          plugins: { legend: { display: datasets.length > 1 } },
          scales: {
            x: { stacked: !!options.stacked, grid: { display: false } },
            y: {
              stacked: !!options.stacked,
              beginAtZero: true,
              ticks: { precision: 0 },
            },
          },
          indexAxis: options.horizontal ? "y" : "x",
        },
      }),
    );
    return true;
  }
  window.DarbGoCharts = {
    draw,
    clear: (id) => {
      instances.get(id)?.destroy();
      instances.delete(id);
    },
  };
})();
