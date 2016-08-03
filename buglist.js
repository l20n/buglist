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
    url.searchParams.append('status_whiteboard', '[gecko-l20n]');
    fetch(url).then(function (response) {
        return response.json();
    }).then(saveBugs);
}

function saveBugs(data) {
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
        bug.resolved_deps = [];
        newbugs.add(bug.id);
        if (bug.status === 'RESOLVED') {
            // if this bug is resolved, strip it from the dependencies of other bugs
            bug.blocks.forEach(function(otherid) {
                var other = knownbugs.get(otherid);
                if (!other) return;
                var i = other.depends_on.indexOf(bug.id);
                other.depends_on.splice(i, 1);
                other.resolved_deps.push(bug.id);
                document.dispatchEvent(
                    new CustomEvent('bug-dependencies-' + other.id, {'detail': {'id': other.id, blocked: !!other.depends_on.length}})
                );
            });
        }
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
        return response.json();
    }).then(saveBugs);
}

findGeckoL20n();
