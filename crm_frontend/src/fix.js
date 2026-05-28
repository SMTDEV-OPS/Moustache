const fs = require('fs');
main();

function main() {
    removeRegex('services/users.ts', [ /'?teamType'?: string;\n?\s*/g, /teamType: '?',?\n?\s*/g ]);
    removeRegex('services/groups.ts', [ /'?teamType'?: string;\n?\s*/g, /teamType: '?,?\n?\s*/g ]);
    removeRegex('services/buddies.ts', [ /teamType\?: string;\n?\s*/g ]);
    
    // Auth context interface
    removeRegex('context/AuthContext.tsx', [ /teamType: string;\n\s*/.test(fs.readFileSync('context/AuthContext.tsx','utf8')) ? /teamType: string;\n\s*/ : /teamType/g ]);
    
    // UserManagement component logic and JSX
    let um = fs.readFileSync('pages/admin/UserManagement.tsx', 'utf8');
    um = um.replace(/teamType: string;/g, '');
    um = um.replace(/const TEAM_TYPES[\s\S]*?\];/g, '');
    um = um.replace(/teamType: form\.teamType,/g, '');
    um = um.replace(/teamType: "MANAGEMENT",?/g, '');
    um = um.replace(/teamType: editingUser\.teamType,/g, '');
    um = um.replace(/<Select value=\{form\.teamType\} onValueChange=\{\(v\) => set\("teamType", v\)\}>[\s\S]*?<\/Select>[\s\S]*?<\/p>/g, '');
    um = um.replace(/<div className="space-y-1\.5">\s*<Label className="text-sm font-medium">Team\s*Type<\/Label>[\s\S]*?<\/div>/g, '');
    um = um.replace(/<Select value=\{filterTeam\}.*?<\/Select>/gs, '');
    um = um.replace(/const \[filterTeam, setFilterTeam\] = useState\("ALL"\);/g, '');
    um = um.replace(/const matchesTeam = filterTeam === "ALL" \|\| u\.teamType === filterTeam;/g, '');
    um = um.replace(/&& matchesTeam/g, '');
    um = um.replace(/filterTeam !== "ALL" \|\| /g, '');
    um = um.replace(/setFilterTeam\("ALL"\);/g, '');
    um = um.replace(/<th className=".*?"(?: >|>)?Team<\/th>/g, '');
    um = um.replace(/<!-- Team -->[\s\S]*?<\/td>/g, '');
    um = um.replace(/{\/\* Team \*\/}[\s\S]*?<\/td>/g, '');
    um = um.replace(/<Badge variant="secondary" className="font-normal whitespace-nowrap">[\s\S]*?<\/Badge>/g, '');
    um = um.replace(/const teamLabel = .*?;/g, '');
    um = um.replace(/<Badge variant="secondary" className="font-normal">\{teamLabel\}<\/Badge>/g, '');
    um = um.replace(/· \{TEAM_TYPES\.find[\s\S]*?\n/g, '');
    fs.writeFileSync('pages/admin/UserManagement.tsx', um);
    
    // Rule builder mappings
    let rules = fs.readFileSync('components/LeadAssignmentRules.tsx', 'utf8');
    rules = rules.replace(/rule\.employeeGroupId\.teamType && \([\s\S]*?<\/[Aa]span>\s*\)/g, '');
    rules = rules.replace(/group\.teamType && \([\s\S]*?<\/[Aa]span>\s*\)/g, '');
    fs.writeFileSync('components/LeadAssignmentRules.tsx', rules);

    console.log("Frontend UI purged.");
}

function removeRegex(file, patterns) {
    try {
        let content = fs.readFileSync(file, 'utf8');
        patterns.forEach(r => content = content.replace(r, ''));
        fs.writeFileSync(file, content);
    } catch (e) {}
}
EOF
node fix.js