"use strict";

const characterSets = {
    uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    lowercase: "abcdefghijklmnopqrstuvwxyz",
    numbers: "0123456789",
    symbols: "!@#$%^&*()-_=+[]{};:,.?"
};

const lengthRange = document.getElementById("lengthRange");
const lengthValue = document.getElementById("lengthValue");
const generatorStatus = document.getElementById("generatorStatus");
const resultsSection = document.getElementById("resultsSection");
const passwordResults = document.getElementById("passwordResults");
const historyList = document.getElementById("historyList");
const historyCount = document.getElementById("historyCount");
const historyEmpty = document.getElementById("historyEmpty");
const qrSection = document.getElementById("qrSection");
const qrCanvas = document.getElementById("qrCanvas");
const qrStatus = document.getElementById("qrStatus");

let recentPasswords = [];

// Use rejection sampling so each character is selected without modulo bias.
function secureRandomIndex(maximum) {
    if (!Number.isInteger(maximum) || maximum < 1 || maximum > 256) {
        throw new RangeError("The character set must contain between 1 and 256 characters.");
    }

    const limit = Math.floor(256 / maximum) * maximum;
    const randomByte = new Uint8Array(1);

    do {
        window.crypto.getRandomValues(randomByte);
    } while (randomByte[0] >= limit);

    return randomByte[0] % maximum;
}

function selectedCharacterSets() {
    return Object.entries(characterSets)
        .filter(([name]) => document.getElementById(name).checked)
        .map(([, characters]) => characters);
}

function shuffleCharacters(characters) {
    for (let index = characters.length - 1; index > 0; index -= 1) {
        const swapIndex = secureRandomIndex(index + 1);
        [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
    }

    return characters;
}

function createPassword(length, selectedSets) {
    const allCharacters = selectedSets.join("");
    const passwordCharacters = selectedSets.map((set) => set[secureRandomIndex(set.length)]);

    while (passwordCharacters.length < length) {
        passwordCharacters.push(allCharacters[secureRandomIndex(allCharacters.length)]);
    }

    return shuffleCharacters(passwordCharacters).join("");
}

function calculateStrength(password, selectedSets) {
    const poolSize = selectedSets.join("").length;
    const entropy = password.length * Math.log2(poolSize);
    let label = "Weak";

    if (entropy >= 80) {
        label = "Very Strong";
    } else if (entropy >= 55) {
        label = "Strong";
    } else if (entropy >= 30) {
        label = "Medium";
    }

    return {
        label,
        percentage: Math.min(100, Math.round((entropy / 120) * 100))
    };
}

function setMessage(element, message, isError) {
    element.textContent = message;
    element.classList.toggle("error", Boolean(isError));
}

function makeButton(label, className, accessibleLabel) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    if (accessibleLabel) {
        button.setAttribute("aria-label", accessibleLabel);
    }
    return button;
}

function buildPasswordCard(password, index, selectedSets) {
    const card = document.createElement("article");
    card.className = "password-card";

    const top = document.createElement("div");
    top.className = "password-card-top";

    const title = document.createElement("span");
    title.className = "password-card-title";
    title.textContent = `Password ${index + 1}`;

    const strength = calculateStrength(password, selectedSets);
    const strengthLabel = document.createElement("span");
    strengthLabel.className = "strength-label";
    strengthLabel.dataset.strength = strength.label;
    strengthLabel.textContent = strength.label;
    top.append(title, strengthLabel);

    const fieldRow = document.createElement("div");
    fieldRow.className = "password-field-row";

    const field = document.createElement("input");
    field.className = "password-field";
    if (index === 0) {
        field.id = "password";
    }
    field.type = "password";
    field.value = password;
    field.readOnly = true;
    field.autocomplete = "new-password";
    field.setAttribute("aria-label", `Generated password ${index + 1}`);

    const visibilityButton = makeButton("Show", "small-button", `Show password ${index + 1}`);
    visibilityButton.addEventListener("click", () => {
        const willShow = field.type === "password";
        field.type = willShow ? "text" : "password";
        visibilityButton.textContent = willShow ? "Hide" : "Show";
        visibilityButton.setAttribute("aria-label", `${willShow ? "Hide" : "Show"} password ${index + 1}`);
    });

    const copyButton = makeButton("Copy", "small-button", `Copy password ${index + 1}`);
    copyButton.addEventListener("click", () => copyPassword(password, copyButton));
    fieldRow.append(field, visibilityButton, copyButton);

    const meter = document.createElement("div");
    meter.className = "strength-meter";
    meter.setAttribute("role", "meter");
    meter.setAttribute("aria-label", `Password ${index + 1} strength`);
    meter.setAttribute("aria-valuemin", "0");
    meter.setAttribute("aria-valuemax", "100");
    meter.setAttribute("aria-valuenow", String(strength.percentage));

    const meterFill = document.createElement("span");
    meterFill.style.width = `${strength.percentage}%`;
    meterFill.dataset.strength = strength.label;
    meter.append(meterFill);

    const actions = document.createElement("div");
    actions.className = "card-actions";
    const qrButton = makeButton("▦ Show QR code", "small-button", `Show QR code for password ${index + 1}`);
    qrButton.addEventListener("click", () => showQrCode(password));
    actions.append(qrButton);

    card.append(top, fieldRow, meter, actions);
    return card;
}

// Generate the selected number of passwords and keep their history in memory only.
function generatePassword() {
    const selectedSets = selectedCharacterSets();
    if (selectedSets.length === 0) {
        setMessage(generatorStatus, "Select at least one character type to generate a password.", true);
        return;
    }

    if (!window.crypto || typeof window.crypto.getRandomValues !== "function") {
        setMessage(generatorStatus, "Secure random generation is unavailable in this browser.", true);
        return;
    }

    try {
        const length = Number(lengthRange.value);
        const count = Number(document.getElementById("passwordCount").value);
        const passwords = Array.from({ length: count }, () => createPassword(length, selectedSets));

        passwordResults.replaceChildren(
            ...passwords.map((password, index) => buildPasswordCard(password, index, selectedSets))
        );
        resultsSection.hidden = false;
        document.getElementById("resultCount").textContent =
            `${passwords.length} ${passwords.length === 1 ? "password" : "passwords"}`;

        passwords.forEach((password) => {
            recentPasswords.unshift(password);
        });
        recentPasswords = recentPasswords.slice(0, 20);
        renderHistory();

        setMessage(
            generatorStatus,
            `${passwords.length} ${passwords.length === 1 ? "password" : "passwords"} generated securely on this device.`,
            false
        );
    } catch (error) {
        setMessage(generatorStatus, `Could not generate passwords: ${error.message}`, true);
    }
}

async function copyPassword(password, button) {
    let copied = false;

    try {
        await navigator.clipboard.writeText(password);
        copied = true;
    } catch {
        const temporaryField = document.createElement("textarea");
        temporaryField.value = password;
        temporaryField.setAttribute("readonly", "");
        temporaryField.style.position = "fixed";
        temporaryField.style.left = "-9999px";
        document.body.append(temporaryField);
        temporaryField.select();

        try {
            copied = document.execCommand("copy");
        } catch {
            copied = false;
        } finally {
            temporaryField.remove();
        }
    }

    if (copied) {
        const originalLabel = button.textContent;
        button.textContent = "Copied!";
        setMessage(generatorStatus, "Password copied to your clipboard.", false);
        window.setTimeout(() => {
            if (button.isConnected) {
                button.textContent = originalLabel;
            }
        }, 1400);
    } else {
        setMessage(generatorStatus, "Could not copy the password. Your browser blocked clipboard access.", true);
    }
}

function renderHistory() {
    historyList.replaceChildren();
    historyCount.textContent = String(recentPasswords.length);
    historyEmpty.hidden = recentPasswords.length > 0;

    recentPasswords.forEach((password, index) => {
        const item = document.createElement("li");
        item.className = "history-item";

        const value = document.createElement("span");
        value.className = "history-password";
        value.textContent = password;
        value.title = password;

        const copyButton = makeButton("Copy", "small-button", `Copy history password ${index + 1}`);
        copyButton.addEventListener("click", () => copyPassword(password, copyButton));

        const deleteButton = makeButton("Delete", "small-button", `Delete history password ${index + 1}`);
        deleteButton.addEventListener("click", () => {
            recentPasswords.splice(index, 1);
            renderHistory();
            setMessage(generatorStatus, "Password removed from this session's history.", false);
        });

        item.append(value, copyButton, deleteButton);
        historyList.append(item);
    });
}

function applyTheme(theme) {
    document.body.dataset.theme = theme;
    const isDark = theme === "dark";
    document.getElementById("themeIcon").textContent = isDark ? "☀" : "☾";
    document.getElementById("themeLabel").textContent = isDark ? "Light mode" : "Dark mode";
    document.getElementById("themeToggle").setAttribute(
        "aria-label",
        `Switch to ${isDark ? "light" : "dark"} mode`
    );
}

function initializeTheme() {
    let theme = "light";
    try {
        const savedTheme = window.localStorage.getItem("passgen-theme");
        if (savedTheme === "light" || savedTheme === "dark") {
            theme = savedTheme;
        }
    } catch (error) {
        console.warn("PASSGEN could not read the saved theme preference.", error);
    }
    applyTheme(theme);
}

function toggleTheme() {
    const theme = document.body.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(theme);
    try {
        window.localStorage.setItem("passgen-theme", theme);
    } catch (error) {
        console.warn("PASSGEN could not save the theme preference.", error);
        setMessage(generatorStatus, "Theme changed, but this browser could not save your preference.", true);
    }
}

function updateLengthDisplay() {
    const length = Number(lengthRange.value);
    lengthValue.value = String(length);
    lengthValue.textContent = String(length);
    const progress = ((length - Number(lengthRange.min)) /
        (Number(lengthRange.max) - Number(lengthRange.min))) * 100;
    lengthRange.style.setProperty("--range-progress", `${progress}%`);
}

function appendBits(bits, value, bitCount) {
    for (let bit = bitCount - 1; bit >= 0; bit -= 1) {
        bits.push((value >>> bit) & 1);
    }
}

function multiplyInGaloisField(left, right) {
    let result = 0;
    let multiplicand = left;
    let multiplier = right;

    while (multiplier > 0) {
        if (multiplier & 1) {
            result ^= multiplicand;
        }
        multiplicand <<= 1;
        if (multiplicand & 0x100) {
            multiplicand ^= 0x11d;
        }
        multiplier >>>= 1;
    }

    return result;
}

function reedSolomonRemainder(data, degree) {
    let generator = [1];
    let root = 1;

    for (let index = 0; index < degree; index += 1) {
        const nextGenerator = new Array(generator.length + 1).fill(0);
        generator.forEach((coefficient, position) => {
            nextGenerator[position] ^= coefficient;
            nextGenerator[position + 1] ^= multiplyInGaloisField(coefficient, root);
        });
        generator = nextGenerator;
        root = multiplyInGaloisField(root, 2);
    }

    const remainder = [...data, ...new Array(degree).fill(0)];
    for (let index = 0; index < data.length; index += 1) {
        const factor = remainder[index];
        if (factor !== 0) {
            generator.forEach((coefficient, offset) => {
                remainder[index + offset] ^= multiplyInGaloisField(coefficient, factor);
            });
        }
    }

    return remainder.slice(data.length);
}

function createQrCodewords(password) {
    const bytes = Array.from(new TextEncoder().encode(password));
    const versions = [
        { version: 1, dataCodewords: 19, errorCodewords: 7 },
        { version: 2, dataCodewords: 34, errorCodewords: 10 },
        { version: 3, dataCodewords: 55, errorCodewords: 15 },
        { version: 4, dataCodewords: 80, errorCodewords: 20 }
    ];
    const specification = versions.find(
        (entry) => 4 + 8 + bytes.length * 8 <= entry.dataCodewords * 8
    );

    if (!specification) {
        throw new RangeError("This password is too long to encode as a QR code.");
    }

    const bits = [];
    appendBits(bits, 0b0100, 4);
    appendBits(bits, bytes.length, 8);
    bytes.forEach((byte) => appendBits(bits, byte, 8));

    const maximumBits = specification.dataCodewords * 8;
    appendBits(bits, 0, Math.min(4, maximumBits - bits.length));
    while (bits.length % 8 !== 0) {
        bits.push(0);
    }

    const data = [];
    for (let index = 0; index < bits.length; index += 8) {
        data.push(bits.slice(index, index + 8).reduce((value, bit) => (value << 1) | bit, 0));
    }

    for (let pad = 0; data.length < specification.dataCodewords; pad += 1) {
        data.push(pad % 2 === 0 ? 0xec : 0x11);
    }

    return {
        version: specification.version,
        codewords: [...data, ...reedSolomonRemainder(data, specification.errorCodewords)]
    };
}

function setQrFunctionModule(matrix, x, y, isDark) {
    if (x >= 0 && y >= 0 && y < matrix.length && x < matrix.length) {
        matrix[y][x] = isDark;
    }
}

function drawFinderPattern(matrix, centerX, centerY) {
    for (let dy = -4; dy <= 4; dy += 1) {
        for (let dx = -4; dx <= 4; dx += 1) {
            const distance = Math.max(Math.abs(dx), Math.abs(dy));
            const isDark = distance !== 2 && distance !== 4;
            setQrFunctionModule(matrix, centerX + dx, centerY + dy, isDark);
        }
    }
}

function drawAlignmentPattern(matrix, centerX, centerY) {
    for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
            setQrFunctionModule(
                matrix,
                centerX + dx,
                centerY + dy,
                Math.max(Math.abs(dx), Math.abs(dy)) !== 1
            );
        }
    }
}

function drawQrFormatBits(matrix, mask) {
    const size = matrix.length;
    const formatData = (0b01 << 3) | mask;
    let remainder = formatData;

    for (let index = 0; index < 10; index += 1) {
        remainder = (remainder << 1) ^ (((remainder >>> 9) & 1) * 0x537);
    }

    const formatBits = ((formatData << 10) | remainder) ^ 0x5412;
    const bitAt = (index) => ((formatBits >>> index) & 1) !== 0;

    for (let index = 0; index <= 5; index += 1) {
        setQrFunctionModule(matrix, 8, index, bitAt(index));
    }
    setQrFunctionModule(matrix, 8, 7, bitAt(6));
    setQrFunctionModule(matrix, 8, 8, bitAt(7));
    setQrFunctionModule(matrix, 7, 8, bitAt(8));
    for (let index = 9; index < 15; index += 1) {
        setQrFunctionModule(matrix, 14 - index, 8, bitAt(index));
    }

    for (let index = 0; index < 8; index += 1) {
        setQrFunctionModule(matrix, size - 1 - index, 8, bitAt(index));
    }
    for (let index = 8; index < 15; index += 1) {
        setQrFunctionModule(matrix, 8, size - 15 + index, bitAt(index));
    }
    setQrFunctionModule(matrix, 8, size - 8, true);
}

function makeQrMatrix(password) {
    const { version, codewords } = createQrCodewords(password);
    const size = version * 4 + 17;
    const matrix = Array.from({ length: size }, () => new Array(size).fill(null));

    drawFinderPattern(matrix, 3, 3);
    drawFinderPattern(matrix, size - 4, 3);
    drawFinderPattern(matrix, 3, size - 4);

    for (let index = 8; index < size - 8; index += 1) {
        const isDark = index % 2 === 0;
        if (matrix[6][index] === null) {
            setQrFunctionModule(matrix, index, 6, isDark);
        }
        if (matrix[index][6] === null) {
            setQrFunctionModule(matrix, 6, index, isDark);
        }
    }

    if (version >= 2) {
        const alignmentCenter = size - 7;
        drawAlignmentPattern(matrix, alignmentCenter, alignmentCenter);
    }

    drawQrFormatBits(matrix, 0);

    const dataBits = codewords.flatMap((byte) => {
        const byteBits = [];
        appendBits(byteBits, byte, 8);
        return byteBits;
    });
    let bitIndex = 0;
    let movingUp = true;

    for (let right = size - 1; right >= 1; right -= 2) {
        if (right === 6) {
            right = 5;
        }

        for (let vertical = 0; vertical < size; vertical += 1) {
            const y = movingUp ? size - 1 - vertical : vertical;
            for (let offset = 0; offset < 2; offset += 1) {
                const x = right - offset;
                if (matrix[y][x] === null) {
                    const bit = bitIndex < dataBits.length ? dataBits[bitIndex] : 0;
                    matrix[y][x] = Boolean(bit ^ ((x + y) % 2 === 0 ? 1 : 0));
                    bitIndex += 1;
                }
            }
        }
        movingUp = !movingUp;
    }

    return matrix;
}

function showQrCode(password) {
    qrSection.hidden = false;
    setMessage(qrStatus, "", false);

    try {
        const matrix = makeQrMatrix(password);
        const moduleScale = 8;
        const quietZone = 4;
        const size = (matrix.length + quietZone * 2) * moduleScale;
        const context = qrCanvas.getContext("2d");
        if (!context) {
            throw new Error("Canvas is unavailable in this browser.");
        }

        qrCanvas.width = size;
        qrCanvas.height = size;
        context.imageSmoothingEnabled = false;
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, size, size);
        context.fillStyle = "#111111";

        matrix.forEach((row, y) => {
            row.forEach((isDark, x) => {
                if (isDark) {
                    context.fillRect(
                        (x + quietZone) * moduleScale,
                        (y + quietZone) * moduleScale,
                        moduleScale,
                        moduleScale
                    );
                }
            });
        });

        qrSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (error) {
        setMessage(qrStatus, `Could not create the QR code: ${error.message}`, true);
    }
}

document.getElementById("generateButton").addEventListener("click", generatePassword);
document.getElementById("themeToggle").addEventListener("click", toggleTheme);
document.getElementById("closeQr").addEventListener("click", () => {
    qrSection.hidden = true;
});
lengthRange.addEventListener("input", updateLengthDisplay);
initializeTheme();
updateLengthDisplay();
renderHistory();
