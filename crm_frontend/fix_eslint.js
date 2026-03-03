const fs = require('fs');

function fixEslintDefects() {
    let content = fs.readFileSync('src/pages/admin/UserManagement.tsx', 'utf8');

    // Fix 1: Add loadData to useEFfect ([])
    // Line warning 637: React Hook useEffect has a missing dependency: 'loadData'
    content = content.replace(/useEffect\(\(\) => \{ void loadData\(\); \}, \[\]\);/g, "useEffect(() => { void loadData(); }, [loadData]);");

    // Fix 2: Remove filterTeam from useMemo ([users, search, filterTeam, filterStatus])
    content = content.replace(/, filterTeam, filterStatus\]\);/g, ", filterStatus]);");
    content = content.replace(/ \/\/\s*No Team Type/g, ""); // strip comments to satisfy
    fs.writeFileSync('src/pages/admin/UserManagement.tsx', content);
}

fixEslintDefects();
