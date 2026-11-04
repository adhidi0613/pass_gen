(() => {
    "use strict";

    const storageKey = "passgen-expiry-reminders";
    const form = document.getElementById("expiryForm");
    const accountLabel = document.getElementById("accountLabel");
    const expiryDate = document.getElementById("expiryDate");
    const expiryStatus = document.getElementById("expiryStatus");
    const expiryList = document.getElementById("expiryList");
    const expiryEmpty = document.getElementById("expiryEmpty");
    const enableNotifications = document.getElementById("enableNotifications");
    let reminders = [];

    function setStatus(message, isError = false) {
        expiryStatus.textContent = message;
        expiryStatus.classList.toggle("error", isError);
    }

    function localDateString(date = new Date()) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    function dayNumber(dateString) {
        const [year, month, day] = dateString.split("-").map(Number);
        return Date.UTC(year, month - 1, day) / 86400000;
    }

    function formatDate(dateString) {
        const [year, month, day] = dateString.split("-").map(Number);
        return new Date(year, month - 1, day).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric"
        });
    }

    function describeDueDate(dateString) {
        const daysUntil = dayNumber(dateString) - dayNumber(localDateString());
        if (daysUntil < 0) {
            const daysOverdue = Math.abs(daysUntil);
            return `Overdue by ${daysOverdue} ${daysOverdue === 1 ? "day" : "days"}`;
        }
        if (daysUntil === 0) {
            return "Due today";
        }
        return `Due in ${daysUntil} ${daysUntil === 1 ? "day" : "days"}`;
    }

    function persist(nextReminders) {
        window.localStorage.setItem(storageKey, JSON.stringify(nextReminders));
        reminders = nextReminders;
        render();
    }

    function render() {
        expiryList.replaceChildren();
        expiryEmpty.hidden = reminders.length > 0;

        [...reminders]
            .sort((left, right) => left.date.localeCompare(right.date))
            .forEach((reminder) => {
                const item = document.createElement("li");
                item.className = "expiry-item";

                const info = document.createElement("div");
                info.className = "reminder-info";

                const label = document.createElement("strong");
                label.textContent = reminder.label;

                const due = document.createElement("small");
                due.textContent = `${formatDate(reminder.date)} · ${describeDueDate(reminder.date)}`;
                if (dayNumber(reminder.date) <= dayNumber(localDateString())) {
                    due.classList.add("due");
                }
                info.append(label, due);

                const deleteButton = document.createElement("button");
                deleteButton.type = "button";
                deleteButton.className = "small-button delete-reminder";
                deleteButton.textContent = "Remove";
                deleteButton.setAttribute("aria-label", `Remove reminder for ${reminder.label}`);
                deleteButton.addEventListener("click", () => {
                    try {
                        persist(reminders.filter((entry) => entry.id !== reminder.id));
                        setStatus(`Reminder for ${reminder.label} removed.`);
                    } catch (error) {
                        setStatus(`Could not remove the reminder: ${error.message}`, true);
                    }
                });

                item.append(info, deleteButton);
                expiryList.append(item);
            });
    }

    function loadReminders() {
        try {
            const saved = window.localStorage.getItem(storageKey);
            if (saved === null) {
                return;
            }

            const parsed = JSON.parse(saved);
            if (!Array.isArray(parsed) || parsed.some((entry) =>
                !entry || typeof entry.id !== "string" ||
                typeof entry.label !== "string" ||
                typeof entry.date !== "string" ||
                !/^\d{4}-\d{2}-\d{2}$/.test(entry.date) ||
                (entry.notifiedOn !== null && entry.notifiedOn !== undefined &&
                    !/^\d{4}-\d{2}-\d{2}$/.test(entry.notifiedOn)))) {
                throw new Error("Saved reminders have an invalid format.");
            }
            reminders = parsed;
        } catch (error) {
            setStatus(`Could not load saved reminders: ${error.message}`, true);
        }
    }

    function checkDueNotifications() {
        if (!("Notification" in window) || Notification.permission !== "granted") {
            return;
        }

        const today = localDateString();
        const dueReminders = reminders.filter((reminder) =>
            reminder.date <= today && reminder.notifiedOn !== today
        );
        if (dueReminders.length === 0) {
            return;
        }

        const dueIds = new Set(dueReminders.map((reminder) => reminder.id));
        const updatedReminders = reminders.map((reminder) =>
            dueIds.has(reminder.id) ? { ...reminder, notifiedOn: today } : reminder
        );

        try {
            persist(updatedReminders);
            dueReminders.forEach((reminder) => {
                new Notification("Password review reminder", {
                    body: `${reminder.label} is due for a password review.`,
                    tag: `passgen-expiry-${reminder.id}`
                });
            });
        } catch (error) {
            setStatus(`Could not record or show due notifications: ${error.message}`, true);
        }
    }

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const label = accountLabel.value.trim();
        const date = expiryDate.value;
        if (!label || label.length > 60 || !date || date < localDateString()) {
            setStatus("Enter an account name (up to 60 characters) and a review date today or later.", true);
            return;
        }

        const reminder = {
            id: window.crypto.randomUUID(),
            label,
            date,
            notifiedOn: null
        };

        try {
            persist([reminder, ...reminders]);
            form.reset();
            expiryDate.min = localDateString();
            setStatus(`Reminder for ${label} added.`);
            checkDueNotifications();
        } catch (error) {
            setStatus(`Could not save the reminder: ${error.message}`, true);
        }
    });

    enableNotifications.addEventListener("click", async () => {
        if (!("Notification" in window)) {
            setStatus("Browser notifications are not supported here.", true);
            return;
        }

        try {
            const permission = await Notification.requestPermission();
            if (permission === "granted") {
                setStatus("Notifications enabled. Due reminders will be checked while this page is open.");
                checkDueNotifications();
            } else if (permission === "denied") {
                setStatus("Notifications were blocked. You can still review reminders on this page.", true);
            } else {
                setStatus("Notification permission was not granted.");
            }
        } catch (error) {
            setStatus(`Could not enable notifications: ${error.message}`, true);
        }
    });

    expiryDate.min = localDateString();
    if (!("Notification" in window)) {
        enableNotifications.disabled = true;
        enableNotifications.title = "Browser notifications are not supported.";
    }
    loadReminders();
    render();
    checkDueNotifications();
    window.setInterval(checkDueNotifications, 60000);
})();
