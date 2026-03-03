const fs = require('fs');

main();

function main() {
    console.log("Removing TeamType...");
    removeRegex('src/models/common.ts', [
        /,\s*TeamType/g,
        /TeamType,\s*/g,
        /export enum TeamType {[\s\S]*?}\n\n/g
    ]);

    removeRegex('src/models/user.ts', [
        /,\s*TeamType/g,
        /TeamType,\s*/g,
        /\s*teamType: TeamType;/g,
        /\s*teamType: {.*?},?.*?/g
    ]);

    removeRegex('src/models/employeeGroup.ts', [
        /,\s*TeamType/g,
        /TeamType,\s*/g,
        /\s*teamType\?: TeamType;.*?/g,
        /\s*teamType: {.*?},.*?\n/g,
    ]);

    removeRegex('src/models/lead.ts', [
        /\s*assignedTeamType\?: string;/g,
        /\s*assignedTeamType: {.*?},.*?/g
    ]);

    removeRegex('src/models/ticket.ts', [
        /\s*assignedTeamType\?: string;/g,
        /\s*assignedTeamType: {.*?},.*?/g
    ]);

    removeRegex('src/models/notification.ts', [
        /\s*groupTeamType\?: string;/g,
        /\s*groupTeamType: {.*?},.*?/g,
    ]);

    removeRegex('src/routes/users.ts', [
        /,\s*teamType/g,
        /teamType,\s*/g,
        /\s*if \(teamType\) filter\.teamType = teamType;/g,
    ]);

    removeRegex('src/routes/groups.ts', [
        /,\s*teamType/g,
        /teamType,\s*/g,
        /\s*if \(teamType\) {\n\s+filter\.teamType = teamType;\n\s+}\n/g,
    ]);

    removeRegex('src/routes/assignmentRules.ts', [
        / name description teamType isActive/g
    ]);
    
    // Replace " name description teamType isActive" with " name description isActive" in assignmentRules.ts.
    let amContent = fs.readFileSync('src/routes/assignmentRules.ts', 'utf8');
    amContent = amContent.replace(/name description teamType isActive/g, 'name description isActive');
    fs.writeFileSync('src/routes/assignmentRules.ts', amContent);
}

function removeRegex(file, patterns) {
    try {
        let content = fs.readFileSync(file, 'utf8');
        patterns.forEach(r => content = content.replace(r, ''));
        fs.writeFileSync(file, content);
        console.log(`Updated ${file}`);
    } catch (e) { console.error(`Failed ${file}:`, e.message); }
}
EOF
node script.js