import readXlsxFile from 'read-excel-file/browser';
import Papa from 'papaparse';

const HEADER_ALIASES = {
    category_name: ['category', 'categoryname', 'cat', 'section', 'group'],
    item_number: ['itemnumber', 'itemno', 'number', 'code', 'itemcode', 'dishnumber', 'menuitemnumber'],
    name: ['item', 'itemname', 'name', 'dish', 'dishname', 'menuitem', 'menuitemname'],
    price: ['price', 'amount', 'cost', 'rate', 'unitprice', 'sellingprice'],
    notes: ['notes', 'note', 'description', 'details'],
    is_active: ['active', 'isactive', 'enabled', 'status'],
};

const REQUIRED_FIELDS = ['category_name', 'item_number', 'name', 'price'];

const normalizeHeader = (value) => String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const trimCell = (value) => String(value ?? '').trim();

const normalizeItemNumber = (value) => trimCell(value).replace(/\.0+$/, '');

const parsePrice = (value) => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : Number.NaN;
    }

    let cleaned = trimCell(value).replace(/[^\d,.-]/g, '');
    if (!cleaned) return Number.NaN;

    const hasComma = cleaned.includes(',');
    const hasDot = cleaned.includes('.');

    if (hasComma && hasDot) {
        if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
            cleaned = cleaned.replace(/\./g, '').replace(',', '.');
        } else {
            cleaned = cleaned.replace(/,/g, '');
        }
    } else if (hasComma) {
        cleaned = cleaned.replace(',', '.');
    }

    const next = Number(cleaned);
    return Number.isFinite(next) ? next : Number.NaN;
};

const parseIsActive = (value) => {
    if (typeof value === 'boolean') return value;

    const normalized = trimCell(value).toLowerCase();
    if (!normalized) return true;
    if (['1', 'true', 'yes', 'y', 'active', 'enabled', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'n', 'inactive', 'disabled', 'off'].includes(normalized)) return false;
    return true;
};

const isRowEmpty = (row) => Object.values(row).every((value) => trimCell(value) === '');

const resolveColumnMap = (headers) => {
    const headerMap = new Map(headers.map((header) => [normalizeHeader(header), header]));
    const resolved = {};

    Object.entries(HEADER_ALIASES).forEach(([field, aliases]) => {
        resolved[field] = aliases.map((alias) => headerMap.get(alias)).find(Boolean) ?? null;
    });

    const missingFields = REQUIRED_FIELDS.filter((field) => !resolved[field]);
    if (missingFields.length > 0) {
        const readable = missingFields.map((field) => {
            if (field === 'category_name') return 'Category';
            if (field === 'item_number') return 'Item Number';
            if (field === 'name') return 'Item Name';
            if (field === 'price') return 'Price';
            return field;
        });
        throw new Error(`Missing required columns: ${readable.join(', ')}.`);
    }

    return resolved;
};

const normalizeImportRows = (rows, sourceLabel) => {
    if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error(`No rows were found in ${sourceLabel}.`);
    }

    const nonEmptyRows = rows.filter((row) => !isRowEmpty(row));
    if (nonEmptyRows.length === 0) {
        throw new Error(`No menu rows were found in ${sourceLabel}.`);
    }

    const columnMap = resolveColumnMap(Object.keys(nonEmptyRows[0]));
    const seenItemNumbers = new Set();

    const items = nonEmptyRows.map((row, index) => {
        const rowNumber = index + 2;
        const categoryName = trimCell(row[columnMap.category_name]);
        const itemNumber = normalizeItemNumber(row[columnMap.item_number]);
        const name = trimCell(row[columnMap.name]);
        const price = parsePrice(row[columnMap.price]);
        const notes = columnMap.notes ? trimCell(row[columnMap.notes]) : '';
        const isActive = columnMap.is_active ? parseIsActive(row[columnMap.is_active]) : true;

        if (!categoryName) throw new Error(`Row ${rowNumber}: category is required.`);
        if (!itemNumber) throw new Error(`Row ${rowNumber}: item number is required.`);
        if (!name) throw new Error(`Row ${rowNumber}: item name is required.`);
        if (!Number.isFinite(price) || price < 0) throw new Error(`Row ${rowNumber}: price must be a valid non-negative number.`);

        if (seenItemNumbers.has(itemNumber)) {
            throw new Error(`Duplicate item number "${itemNumber}" found in ${sourceLabel}.`);
        }
        seenItemNumbers.add(itemNumber);

        return {
            category_name: categoryName,
            item_number: itemNumber,
            name,
            price,
            notes,
            is_active: isActive,
        };
    });

    const categoryNames = [];
    const categoryKeys = new Set();
    items.forEach((item) => {
        const key = item.category_name.toLowerCase();
        if (!categoryKeys.has(key)) {
            categoryKeys.add(key);
            categoryNames.push(item.category_name);
        }
    });

    return {
        sourceLabel,
        items,
        categories: categoryNames,
        previewRows: items.slice(0, 6),
    };
};

const parseCsvRows = (text, sourceLabel) => {
    const parsed = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        transformHeader: (header) => trimCell(header),
    });

    if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
        throw new Error(`Unable to parse ${sourceLabel}: ${parsed.errors[0].message}`);
    }

    return normalizeImportRows(parsed.data ?? [], sourceLabel);
};

const parseXlsxRows = async (file, sourceLabel) => {
    let rows;
    try {
        rows = await readXlsxFile(file);
    } catch {
        throw new Error(
            `Unable to read ${sourceLabel}. Use a valid .xlsx file or export as CSV.`,
        );
    }

    if (!Array.isArray(rows) || rows.length < 2) {
        throw new Error(`No worksheet rows were found in ${sourceLabel}.`);
    }

    const headers = rows[0].map((value) => trimCell(value));
    const rowObjects = rows.slice(1).map((row) => {
        const normalized = {};
        headers.forEach((header, index) => {
            normalized[header] = row[index] ?? '';
        });
        return normalized;
    });

    return normalizeImportRows(rowObjects, sourceLabel);
};

export const MENU_IMPORT_REQUIRED_COLUMNS = ['Category', 'Item Number', 'Item Name', 'Price'];

export const parseMenuImportFile = async (file) => {
    const sourceLabel = file.name || 'Spreadsheet';
    const extension = sourceLabel.split('.').pop()?.toLowerCase();

    if (extension === 'csv') {
        const text = await file.text();
        return parseCsvRows(text, sourceLabel);
    }

    if (extension === 'xlsx') {
        return parseXlsxRows(file, sourceLabel);
    }

    throw new Error('Unsupported file type. Upload .xlsx or .csv.');
};

export const buildGoogleSheetCsvUrl = (value) => {
    const input = trimCell(value);
    if (!input) {
        throw new Error('Paste a Google Sheet URL first.');
    }

    let url;
    try {
        url = new URL(input);
    } catch {
        throw new Error('Enter a valid Google Sheet URL.');
    }

    const match = url.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
        return input;
    }

    const spreadsheetId = match[1];
    const gidFromHash = url.hash.match(/gid=(\d+)/)?.[1];
    const gid = url.searchParams.get('gid') || gidFromHash || '0';
    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
};

export const parseMenuImportGoogleSheet = async (value) => {
    const csvUrl = buildGoogleSheetCsvUrl(value);
    const response = await fetch(csvUrl);
    if (!response.ok) {
        throw new Error('Unable to fetch that Google Sheet. Make sure the sheet is shared publicly or published.');
    }

    const text = await response.text();
    return parseCsvRows(text, 'Google Sheet');
};
