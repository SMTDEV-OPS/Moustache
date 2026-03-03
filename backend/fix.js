const fs = require('fs');

const removeRegex = (file, patterns) => {
    try {
        let content = fs.readFileSync(file, 'utf8');
        patterns.forEach(regex => {
            content = content.replace(regex, '');
        });
        fs.writeFileSync(file, content);
        console.log(`Updated ${file}`);
    } catch (err) {
        console.error(`Skipping ${file} - ${err.message}`);
    }
};

removeRegex('src/services/leadService.ts', [
    /function determineTeamType[\s\S]*?\n\}/g,
    /\n\s+TeamType,/g,
    /\n\s+assignedTeamType\?: TeamType;/g,
    /\s+const teamType = determineTeamType\(source\);\n/,
    /\s+assignedTeamType: .*?,\n/g,
    /\n\s+assignedTeamType\?: string;/g,
    /\n\s+teamType: {.*?},\n/g
]);

removeRegex('src/services/ticketService.ts', [
    /\n\s+TeamType,/g,
    /\n\s+assignedTeamType\?: TeamType;/g,
    /\s+assignedTeamType: .*?,\n/g,
    /\s+teamType: TeamType\.OPERATIONS,\n/g
]);

removeRegex('src/services/assignmentService.ts', [
    /, TeamType/g,
    /\s+requiredTeamType\?: TeamType/g,
    /\s+if \(requiredTeamType\) \{\n\s+query\.teamType = requiredTeamType;\n\s+\}\n/g,
    /,?\s*requiredTeamType/g,
    /function determineRequiredTeamType[\s\S]*?\n\}/g,
    /\s+const requiredTeamType = determineRequiredTeamType.*?\n/g
]);

removeRegex('src/routes/users.ts', [
    /\nimport { TeamType } from "\.\.\/models\/common";/g,
    /\n\s+teamType: z\.nativeEnum\(TeamType\),/g,
    /\n\s+teamType: z\.nativeEnum\(TeamType\)\.optional\(\),/g,
    /teamType,\s?/g,
    /,?\s*teamType: user\.teamType/g,
    /teamType\s*=\s*teamType;/g
]);

