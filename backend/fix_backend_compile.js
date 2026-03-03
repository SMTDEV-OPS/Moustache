const fs = require('fs');

function fixAssignmentService() {
    let content = fs.readFileSync('src/services/assignmentService.ts', 'utf8');
    // Error: "const = determineRequiredTeamType(leadType, source);" left over
    content = content.replace(/const.*?= determineRequiredTeamType\(leadType, source\);?\n?/g, '');
    
    // Also "requiredTeamType" may still exist in findEligibleUsers function call arguments where it's missing
    content = content.replace(/await findEligibleUsers\(rule\.employeeGroupId,.*?\)/g, 'await findEligibleUsers(rule.employeeGroupId)');
    content = content.replace(/await findAllGroupUsers\(rule\.employeeGroupId,.*?\)/g, 'await findAllGroupUsers(rule.employeeGroupId)');

    // In function parameters: findEligibleUsers(groupId: Types.ObjectId, ) -> findEligibleUsers(...)
    content = content.replace(/findEligibleUsers\s*\([^,]+,?\s*\)/g, match => match.replace(/,\s*\)/, ')'));
    fs.writeFileSync('src/services/assignmentService.ts', content);
}

function fixGroupsRoute() {
    let content = fs.readFileSync('src/routes/groups.ts', 'utf8');
    // Error TS1472: catch or finally expected likely due to missing braces replaced by my regex
    // Looks like I removed something like: "if (teamType) {"
    // I need to look at what's around line 42 of src/routes/groups.ts
    // For now I won't rewrite without seeing the code, let's just dump lines 35-55
    console.log("=== GROUPS.TS ===");
    console.log(content.split('\n').slice(35, 55).map((l,i) => `${i+36}: ${l}`).join('\n'));
}

fixAssignmentService();
fixGroupsRoute();
EOF
node fix_backend_compile.js