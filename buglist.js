/* global URL, fetch, CustomEvent */

var newbugs = new Set(), knownbugs = new Map(), tracker;

const bugapi = 'https://bugzilla.mozilla.org/rest/bug';
const fields = 'id,alias,product,component,summary,status,resolution,assigned_to,depends_on,blocks,cf_user_story';

function getBugAPI() {
    var url = new URL(bugapi);
    url.searchParams.append('include_fields', fields);
    return url;
}

function findGeckoL20n() {
    var url = getBugAPI();
    url.searchParams.append('alias', 'gecko-l20n');
    fetch(url).then(function (response) {
        console.log('got response');
        return response.json();
    }).then(saveBugs);
}

function saveBugs(data) {
    console.log('got bugs');
    console.log(data.bugs.length);
    if (! data.bugs.length) {
        done();
        console.log('done loading');
        return;
    }
    newbugs = new Set();
    data.bugs.forEach(function(bug) {
        if (knownbugs.has(bug.id)) {
            return;
        }
        if (bug.alias === 'gecko-l20n') {
            tracker = bug.id;
        }
        newbugs.add(bug.id);
        knownbugs.set(bug.id, bug);
    });
    if (newbugs.size) {
        document.dispatchEvent(
            new CustomEvent('bug-data', {'detail': {'newbugs': Array.from(newbugs)}})
        );
        queryMoreBugs();
    }
    else {
        done();
        console.log('done loading');
    }
}

function done() {
    document.getElementById('loading').textContent = '';
}

function queryMoreBugs() {
    var url = getBugAPI();
    var params = url.searchParams;
    // exclude knownbugs
    // params.append('bug_id_type', 'nowords');
    // params.append('bug_id', Array.from(knownbugs.keys()).join(','));
    // query for blocks
    // params.append('j_top', 'OR'); < NOT NEEDED
    ['blocked'].forEach(function(rel, i) {
        params.append('f' + (i + 1), rel);
        params.append('o' + (i + 1), 'anyexact');
        params.append('v' + (i + 1), Array.from(newbugs).join(','));
    });
    fetch(url).then(function(response) {
        console.log('got dependencies');
        return response.json();
    }).then(saveBugs);
}

findGeckoL20n();
