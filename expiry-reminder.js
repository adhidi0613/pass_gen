<!-- Add this section inside the <body> of your existing index.html -->
<section class="expiry-card" aria-labelledby="expiry-title">
  <h2 id="expiry-title">Password Expiry Reminder</h2>
  <p class="expiry-help">Set a reminder to review a password. This saves only the label and dates—not the password itself.</p>

  <form id="expiryForm">
    <label for="accountLabel">Website or account name</label>
    <input id="accountLabel" type="text" maxlength="60"
           placeholder="Example: Email account" required>

    <label for="expiryDate">Password review date</label>
    <input id="expiryDate" type="date" required>

    <button type="submit">Save reminder</button>
  </form>

  <p id="expiryStatus" class="expiry-status" role="status" aria-live="polite"></p>
  <div class="expiry-list-wrap">
    <h3>Your reminders</h3>
    <ul id="expiryList" class="expiry-list"></ul>
  </div>
  <button type="button" id="enableNotifications" class="secondary-button">
    Enable browser notifications
  </button>
  <p class="expiry-note">Reminders are checked when this website is open. Browser notifications may require permission.</p>
</section>

<!-- Add this before the closing </body> tag in index.html -->
<link rel="stylesheet" href="expiry-reminder.css">
<script src="expiry-reminder.js" defer></script>
