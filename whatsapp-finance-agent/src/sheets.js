import { google } from "googleapis";

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const TRANSACTIONS_SHEET = "Transactions";
const BUDGETS_SHEET = "Budgets";

const TRANSACTIONS_HEADER = [
  "ID",
  "Date",
  "Type",
  "Amount",
  "Category",
  "Description",
  "User",
];
const BUDGETS_HEADER = ["Category", "MonthlyLimit"];

let sheetsClient = null;

function getAuth() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
  }
  return new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

async function getSheets() {
  if (!sheetsClient) {
    sheetsClient = google.sheets({ version: "v4", auth: getAuth() });
  }
  return sheetsClient;
}

/** יוצר את הגיליונות וכותרות העמודות אם הם לא קיימים עדיין */
export async function ensureSheetsExist() {
  const sheets = await getSheets();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const existing = meta.data.sheets.map((s) => s.properties.title);

  const requests = [];
  for (const title of [TRANSACTIONS_SHEET, BUDGETS_SHEET]) {
    if (!existing.includes(title)) {
      requests.push({ addSheet: { properties: { title } } });
    }
  }
  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests },
    });
  }

  for (const [title, header] of [
    [TRANSACTIONS_SHEET, TRANSACTIONS_HEADER],
    [BUDGETS_SHEET, BUDGETS_HEADER],
  ]) {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${title}!A1:G1`,
    });
    if (!res.data.values || res.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${title}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [header] },
      });
    }
  }
}

/** מוסיף תנועה (הוצאה/הכנסה) ומחזיר את המזהה שלה */
export async function addTransaction({ type, amount, category, description, date, user }) {
  const sheets = await getSheets();
  const id = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const txDate = date || new Date().toISOString().slice(0, 10);
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${TRANSACTIONS_SHEET}!A:G`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[id, txDate, type, amount, category, description || "", user]],
    },
  });
  return { id, date: txDate, type, amount, category, description };
}

/** מחזיר את כל התנועות של משתמש מסוים */
export async function getTransactions(user) {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${TRANSACTIONS_SHEET}!A2:G`,
  });
  const rows = res.data.values || [];
  return rows
    .map((row, i) => ({
      rowNumber: i + 2,
      id: row[0],
      date: row[1],
      type: row[2],
      amount: parseFloat(row[3]) || 0,
      category: row[4],
      description: row[5] || "",
      user: row[6],
    }))
    .filter((tx) => tx.user === user);
}

/** מוחק תנועה לפי מזהה. מחזיר true אם נמצאה ונמחקה */
export async function deleteTransaction(id, user) {
  const sheets = await getSheets();
  const all = await getTransactions(user);
  const tx = all.find((t) => t.id === id);
  if (!tx) return false;

  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheetId = meta.data.sheets.find(
    (s) => s.properties.title === TRANSACTIONS_SHEET
  ).properties.sheetId;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: tx.rowNumber - 1,
              endIndex: tx.rowNumber,
            },
          },
        },
      ],
    },
  });
  return true;
}

/** קובע תקציב חודשי לקטגוריה (מעדכן אם כבר קיים) */
export async function setBudget(category, monthlyLimit) {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${BUDGETS_SHEET}!A2:B`,
  });
  const rows = res.data.values || [];
  const idx = rows.findIndex((r) => r[0] === category);

  if (idx >= 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${BUDGETS_SHEET}!B${idx + 2}`,
      valueInputOption: "RAW",
      requestBody: { values: [[monthlyLimit]] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${BUDGETS_SHEET}!A:B`,
      valueInputOption: "RAW",
      requestBody: { values: [[category, monthlyLimit]] },
    });
  }
  return { category, monthlyLimit };
}

/** מחזיר את כל התקציבים המוגדרים */
export async function getBudgets() {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${BUDGETS_SHEET}!A2:B`,
  });
  const rows = res.data.values || [];
  return rows.map((r) => ({
    category: r[0],
    monthlyLimit: parseFloat(r[1]) || 0,
  }));
}
