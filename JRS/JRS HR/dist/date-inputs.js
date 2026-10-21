/* English date presentation only. Existing form/filter fields retain ISO values. */
(function (root) {
  "use strict";
  let active = null;
  const display = (value) =>
    value ? value.slice(8, 10) + "/" + value.slice(5, 7) + "/" + value.slice(0, 4) : "";
  function iso(value) {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
    if (!match) return null;
    const result = match[3] + "-" + match[2] + "-" + match[1],
      date = new Date(result + "T12:00:00Z");
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === result
      ? result
      : null;
  }
  function close() {
    if (active) {
      active.panel.remove();
      active.button.setAttribute("aria-expanded", "false");
      active = null;
    }
  }
  document.addEventListener("pointerdown", (event) => {
    if (active && !active.wrapper.contains(event.target)) close();
  });
  function enhance(host) {
    if (active && !active.wrapper.isConnected) close();
    host.querySelectorAll('input[type="date"]').forEach((original) => {
      const label =
        original.getAttribute("aria-label") ||
        original.closest("label")?.textContent.trim() ||
        "Date";
      const wrapper = document.createElement("span");
      wrapper.className = "hr-date-control";
      original.before(wrapper);
      wrapper.append(original);
      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = "DD/MM/YYYY";
      input.inputMode = "numeric";
      input.maxLength = 10;
      input.value = display(original.value);
      input.required = original.required;
      input.disabled = original.disabled;
      input.setAttribute("aria-label", label);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "hr-date-trigger";
      button.setAttribute("aria-label", "Open " + label + " calendar");
      button.setAttribute("aria-expanded", "false");
      button.disabled = original.disabled;
      button.innerHTML = typeof root.icon === "function" ? root.icon("calendar") : "Calendar";
      original.type = "hidden";
      wrapper.append(input, button);
      function update(notify = false) {
        const value = input.value.trim(),
          date = value ? iso(value) : "";
        let error =
          date === null
            ? "Enter a valid date using DD/MM/YYYY."
            : !value && input.required
              ? "Enter a date using DD/MM/YYYY."
              : "";
        if (date && original.min && date < original.min)
          error = "Date must be on or after " + display(original.min) + ".";
        if (date && original.max && date > original.max)
          error = "Date must be on or before " + display(original.max) + ".";
        input.setCustomValidity(error);
        original.value = error ? "" : date;
        if (notify && !error) original.dispatchEvent(new Event("change", { bubbles: true }));
        return !error;
      }
      input.addEventListener("input", () => update());
      input.addEventListener("change", () => {
        if (!update(true)) input.reportValidity();
      });
      wrapper.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && active?.wrapper === wrapper) {
          event.preventDefault();
          event.stopPropagation();
          close();
          button.focus();
        }
      });
      button.addEventListener("click", () => {
        if (active?.wrapper === wrapper) {
          close();
          return;
        }
        close();
        const selected =
          iso(input.value) ||
          new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" });
        let year = Number(selected.slice(0, 4)),
          month = Number(selected.slice(5, 7)) - 1,
          view = "days";
        const panel = document.createElement("span");
        panel.className = "hr-date-calendar";
        panel.setAttribute("role", "group");
        panel.setAttribute("aria-label", "Choose " + label);
        active = { panel, wrapper, button };
        wrapper.append(panel);
        button.setAttribute("aria-expanded", "true");
        function render() {
          const first = new Date(Date.UTC(year, month, 1, 12)),
            offset = (first.getUTCDay() + 6) % 7,
            days = new Date(Date.UTC(year, month + 1, 0, 12)).getUTCDate();
          let title = first.toLocaleDateString("en-GB", {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          });
          const decade = Math.floor(year / 10) * 10;
          const unit = view === "days" ? "month" : view === "months" ? "year" : "decade";
          const level =
            view === "days" ? "Choose month" : view === "months" ? "Choose year" : "Year range";
          if (view !== "days")
            title = view === "months" ? String(year) : decade + "–" + (decade + 9);
          let cells = "<span></span>".repeat(offset);
          for (let day = 1; day <= days; day++) {
            const date =
              String(year).padStart(4, "0") +
              "-" +
              String(month + 1).padStart(2, "0") +
              "-" +
              String(day).padStart(2, "0");
            const description = new Date(date + "T12:00:00Z").toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            });
            cells += `<button type="button" data-date="${date}" aria-label="${description}" ${(original.min && date < original.min) || (original.max && date > original.max) ? "disabled" : ""}>${day}</button>`;
          }
          let options = "";
          if (view === "months")
            for (let value = 0; value < 12; value++)
              options +=
                '<button type="button" data-pick-month="' +
                value +
                '">' +
                new Date(Date.UTC(2024, value, 1)).toLocaleDateString("en-GB", {
                  month: "long",
                  timeZone: "UTC",
                }) +
                "</button>";
          if (view === "years")
            for (let value = decade; value < decade + 10; value++)
              options +=
                '<button type="button" data-year="' +
                value +
                '" ' +
                (value < 1 || value > 9999 ? "disabled" : "") +
                ">" +
                value +
                "</button>";
          panel.innerHTML =
            '<span class="hr-date-month"><button type="button" data-month="-1" aria-label="Previous ' +
            unit +
            '">‹</button><button type="button" data-level="true" aria-label="' +
            level +
            '">' +
            title +
            '</button><button type="button" data-month="1" aria-label="Next ' +
            unit +
            '">›</button></span>' +
            (view === "days"
              ? '<span class="hr-date-days">' +
                ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
                  .map((day) => "<small>" + day + "</small>")
                  .join("") +
                cells +
                "</span>"
              : '<span class="hr-date-options">' + options + "</span>") +
            '<button type="button" data-clear="true">Clear date</button>';
        }
        panel.addEventListener("click", (event) => {
          const target = event.target.closest("button");
          if (!target || target.disabled) return;
          if (target.dataset.level) {
            view = view === "days" ? "months" : "years";
            render();
            return;
          }
          if (target.dataset.year !== undefined) {
            year = Number(target.dataset.year);
            view = "months";
            render();
            return;
          }
          if (target.dataset.pickMonth !== undefined) {
            month = Number(target.dataset.pickMonth);
            view = "days";
            render();
            return;
          }
          if (target.dataset.month) {
            if (view !== "days") {
              year = Math.max(
                1,
                Math.min(9999, year + Number(target.dataset.month) * (view === "years" ? 10 : 1)),
              );
              render();
              return;
            }
            month += Number(target.dataset.month);
            if (month < 0) {
              month = 11;
              year--;
            }
            if (month > 11) {
              month = 0;
              year++;
            }
            render();
            return;
          }
          input.value = target.dataset.clear ? "" : display(target.dataset.date);
          close();
          update(true);
          if (button.isConnected) button.focus();
        });
        render();
      });
      update();
    });
  }
  root.HRDateInputs = { enhance };
})(window);
