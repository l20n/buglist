/* global knownbugs */
"use strict";

document.addEventListener('bug-data', ondata, true);
document.addEventListener('DOMContentLoaded', onload, true);

function ondata(e) {
    console.log('CE', e.detail.newbugs);
    bcl && bcl.renderBugs(e.detail.newbugs);
}

class BugCount {
    constructor(prod, component, mount) {
        this.mount = mount;
        this._dom = document.querySelector('#templates > .bugcount').cloneNode(true);
        this._dom.querySelector(".product").textContent = prod;
        this._dom.querySelector(".component").textContent = component;
        this._dom.id = (prod + '_' + component).replace(/\W/g,'_');
        // hook up collapse IDs and href
        var body_id = this._dom.id + '_body';
        this._dom.querySelector(".panel-body").id = body_id;
        this._dom.querySelector("a").href = '#' + body_id;
        this.count_dom = this._dom.querySelector('.count');
        this.count = 1;
        var child = null;
        for (var i=0, ii=mount.children.length; i<ii; ++i) {
            if (mount.children[i].id > this._dom.id) {
                child = mount.children[i];
                break;
            }
        }
        mount.insertBefore(this._dom, child);
    }
    get count() {
        return this._count ? this._count : 0;
    }
    set count(val) {
        this._count = val;
        if (this.count_dom) {
            this.count_dom.textContent = val;
        }
    }
    
}

class BugCountList {
    constructor(mount) {
        this.mount = mount;
        this.children = new Map();
    }
    renderBugs(newbugs) {
        if (newbugs.length == 0) return;
        var updates = new Set();
        newbugs.forEach(function(bugid) {
            var bug = knownbugs.get(bugid);
            var key = bug.product + '_' + bug.component;
            updates.add(key);
            if (this.children.has(key)) {
                this.children.get(key).count += 1;
            }
            else {
                this.children.set(key, new BugCount(bug.product, bug.component, this.mount));
            }
        }, this);
        updates = Array.from(updates);
        updates.sort();
        
    }
}

var bcl;
function onload() {
    bcl = new BugCountList(document.getElementById('app'));
    if (knownbugs.size) {
        bcl.renderBugs(Array.from(knownbugs.keys()));
    }
}
