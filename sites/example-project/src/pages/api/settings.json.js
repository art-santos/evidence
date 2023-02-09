import fs from 'fs';
import path from 'path';
import gitRemoteOriginUrl from 'git-remote-origin-url'; // get the git repo
import { dev } from '$app/env';
import logEvent from '@evidence-dev/telemetry'; 

function getLocalGitRepo () {
    if(fs.existsSync(path.join(path.resolve('../../'), '.git'))){
        return path.resolve('../../') 
    }
}

export async function get() {
    if (!dev) {
        return {
            status: 404
        }
    }
    else { 
        let settings = {}
        let gitIgnore
        if (fs.existsSync('evidence.settings.json')) {
            settings = JSON.parse(fs.readFileSync('evidence.settings.json', 'utf8'));
        }
        if (fs.existsSync('../../.gitignore')) {
            gitIgnore = fs.readFileSync('../../.gitignore', 'utf8')
        }
        try{
            settings.localGitRepo = getLocalGitRepo();
            settings.gitRepo = await gitRemoteOriginUrl()
        }catch {
            
        }
        return {
            header: "accept: application/json",
            status: 200,
            body: {
                settings,
                gitIgnore
            }
        }
    }
}

function removeFromGitignore(extensions, hasGitIgnore, gitIgnore) {
    if(hasGitIgnore){
        extensions.forEach(ext => {
            // Find newline plus extension and only match those strings which are directly
            // followed by either a new line or the end of the file contents
            // (stops the issue of matching .sqlite within the .sqlite3 string)
            // g means global match - same behaviour as replaceAll
            let regex = new RegExp(`\n${ext}(?=\n|$)`, "g")
            gitIgnore = gitIgnore.replace(regex, "")
        })
        fs.writeFileSync('../../.gitignore', gitIgnore)    
    }
}

function addToGitignore(extensions, gitIgnore) {
    extensions.forEach(ext => {
        let regex = new RegExp(`\n${ext}(?=\n|$)`, "g")
        if(!gitIgnore.match(regex)){
            gitIgnore = gitIgnore + ("\n" + ext)
        }
    })
    fs.writeFileSync('../../.gitignore', gitIgnore)
}
 
export function post(request) {    
    const {settings} = JSON.parse(request.body)
    // read original settings file 
    let originalSettings = {}
    if (fs.existsSync('evidence.settings.json')) {
        originalSettings = JSON.parse(fs.readFileSync('evidence.settings.json', 'utf8'));
    } 
    // check if send_anonymous_usage_stats has changed and log an event if it has changed from not 'no' (or undefined) to no
    if(originalSettings.send_anonymous_usage_stats != 'no' && settings.send_anonymous_usage_stats === 'no'){
        logEvent('usageStatsDisabled', dev, originalSettings)
    }
    fs.writeFileSync('evidence.settings.json', JSON.stringify(settings));

    // gitignore settings
    let gitIgnore;
    let hasGitIgnore = fs.existsSync('../../.gitignore');
    gitIgnore = hasGitIgnore ? fs.readFileSync('../../.gitignore', 'utf8') : "";
    let extensions;

    if(settings.database === "sqlite"){
        extensions = [".db", ".sqlite", ".sqlite3"]
        if(settings.credentials.gitignoreSqlite === false){
            removeFromGitignore(extensions, hasGitIgnore, gitIgnore)
        } else if(settings.credentials.gitignoreSqlite === true){
            addToGitignore(extensions, gitIgnore)
        }
    } else if(settings.database === "duckdb"){
        extensions = [".duckdb", ".db"]
        if(settings.credentials.gitignoreDuckdb === false){
            removeFromGitignore(extensions, hasGitIgnore, gitIgnore)
        } else if(settings.credentials.gitignoreDuckdb === true){
            addToGitignore(extensions, gitIgnore)
        }
    } else if(settings.database === "csv"){
        extensions = [".csv"]
        if(settings.credentials.gitignoreCsv === false){
            removeFromGitignore(extensions, hasGitIgnore, gitIgnore)
        } else if(settings.credentials.gitignoreCsv === true){
            addToGitignore(extensions, gitIgnore)
        }
    }
    return {
        body: settings
    }
}

// Breaking changes in new verion of Svelte kit - merged on Jan 19, 2022
// https://github.com/sveltejs/kit/pull/3384
// Will need to change to format below once we upgrade our sveltekit dependency:
// export const post = async ({ request }) => {
//     const body = await request.formData();
//     const database = body.get("database");

//     return {
//         body: "settings saved"
//     }
// }