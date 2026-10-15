import assert from 'node:assert';

function paginate(items, page, pageSize) {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedItems = items.slice(startIndex, endIndex);
  const fromItem = totalItems === 0 ? 0 : startIndex + 1;
  const toItem = endIndex;

  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (safeCurrentPage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }
    if (safeCurrentPage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', safeCurrentPage - 1, safeCurrentPage, safeCurrentPage + 1, '...', totalPages];
  };

  return {
    totalItems,
    totalPages,
    safeCurrentPage,
    paginatedItems,
    fromItem,
    toItem,
    pageNumbers: getPageNumbers(),
  };
}

console.log('Testing equipment pagination logic...');

// Test 1: 8 items with pageSize 6
const items8 = Array.from({ length: 8 }, (_, i) => `Item ${i + 1}`);
const page1 = paginate(items8, 1, 6);
assert.strictEqual(page1.totalItems, 8);
assert.strictEqual(page1.totalPages, 2);
assert.strictEqual(page1.safeCurrentPage, 1);
assert.strictEqual(page1.paginatedItems.length, 6);
assert.strictEqual(page1.fromItem, 1);
assert.strictEqual(page1.toItem, 6);
assert.deepStrictEqual(page1.pageNumbers, [1, 2]);

const page2 = paginate(items8, 2, 6);
assert.strictEqual(page2.safeCurrentPage, 2);
assert.strictEqual(page2.paginatedItems.length, 2);
assert.strictEqual(page2.fromItem, 7);
assert.strictEqual(page2.toItem, 8);
assert.deepStrictEqual(page2.pageNumbers, [1, 2]);

// Test 2: Out of bounds page clamps safely
const pageOverflow = paginate(items8, 10, 6);
assert.strictEqual(pageOverflow.safeCurrentPage, 2);
assert.strictEqual(pageOverflow.fromItem, 7);
assert.strictEqual(pageOverflow.toItem, 8);

// Test 3: PageSize 9 fits all 8 items
const pageAll = paginate(items8, 1, 9);
assert.strictEqual(pageAll.totalPages, 1);
assert.strictEqual(pageAll.paginatedItems.length, 8);
assert.strictEqual(pageAll.fromItem, 1);
assert.strictEqual(pageAll.toItem, 8);

// Test 4: Empty items
const empty = paginate([], 1, 6);
assert.strictEqual(empty.totalItems, 0);
assert.strictEqual(empty.totalPages, 1);
assert.strictEqual(empty.fromItem, 0);
assert.strictEqual(empty.toItem, 0);
assert.strictEqual(empty.paginatedItems.length, 0);

// Test 5: Many pages with ellipsis
const items50 = Array.from({ length: 50 }, (_, i) => `Item ${i + 1}`);
const pageMiddle = paginate(items50, 5, 5); // 10 pages total, on page 5
assert.strictEqual(pageMiddle.totalPages, 10);
assert.deepStrictEqual(pageMiddle.pageNumbers, [1, '...', 4, 5, 6, '...', 10]);

console.log('✓ All equipment pagination logic tests passed!');
