/* global knownbugs */
"use strict";

document.addEventListener('bug-data', ondata, true);
document.addEventListener('DOMContentLoaded', onload, true);

function ondata(e) {
    console.log('CE', e.detail.newbugs);
    components && components.renderBugs(e.detail.newbugs);
}

class Component {
    constructor(prod, component, mount) {
        this.mount = mount;
        this._dom = document.querySelector('#templates > .prodcomp').cloneNode(true);
        this._bug_template = document.querySelector('#templates > .bug_template');
        this._dom.querySelector(".product").textContent = prod;
        this._dom.querySelector(".component").textContent = component;
        this._dom.id = (prod + '_' + component).replace(/\W/g,'_');
        // hook up collapse IDs and href
        var body_id = this._dom.id + '_body';
        this._dom.querySelector(".panel-body").id = body_id;
        this._dom.querySelector("a").href = '#' + body_id;
        this.count_dom = this._dom.querySelector('.count');
        this.count = this.blocked = this.unblocked = 0;
        var child = null;
        for (var i=0, ii=mount.children.length; i<ii; ++i) {
            if (mount.children[i].id > this._dom.id) {
                child = mount.children[i];
                break;
            }
        }
        mount.insertBefore(this._dom, child);
    }
    add(bug) {
        var cell, bug_html = this._bug_template.cloneNode(true);
        bug_html.querySelector('.id').textContent = bug.id;
        bug_html.querySelector('a').setAttribute('href', 'https://bugzil.la/' + bug.id);
        bug_html.querySelector('.summary').textContent = bug.summary;
        bug_html.querySelector('.assigned_to').textContent = bug.assigned_to;
        if (bug.depends_on && bug.depends_on.length) {
            cell = bug_html.querySelector('.depends_on');
            cell.classList.add('bg-danger');
            cell.textContent = bug.depends_on.length;
        }
        if (bug.blocks && bug.blocks.length) {
            cell = bug_html.querySelector('.blocks');
            cell.classList.add('bg-warning');
            cell.textContent = bug.blocks.length;
        }
        if (bug.resolution === 'FIXED') {
            bug_html.classList.add('fixed');
        }
        this._dom.querySelector('.bugs').appendChild(bug_html);
        if (bug.resolution !== "") {
            return;
        }
        if (bug.depends_on && bug.depends_on.length) {
            this.blocked += 1;
        }
        else {
            this.unblocked += 1;
        }
        this.count += 1;
    }
    get count() {
        return this._count ? this._count : 0;
    }
    set count(val) {
        this._count = val;
        this.render();
    }
    render() {
        if (!this.count_dom) return;
        this.count_dom.textContent = this.count;
        this._dom.querySelector('.unblocked').textContent = this.unblocked;
    }
}

class BugCountList {
    constructor(mount) {
        this.mount = mount;
        this.children = new Map();
    }
    get(bug) {
        var key = bug.product + '_' + bug.component;
        var component = this.children.get(key);
        if (!component) {
            component = new Component(bug.product, bug.component, this.mount);
            this.children.set(key, component);
        }
        return component;
    }
    renderBugs(newbugs) {
        if (newbugs.length == 0) return;
        newbugs.forEach(function(bugid) {
            var bug = knownbugs.get(bugid);
            var component = this.get(bug);
            component.add(bug);
        }, this);
    }
}

var components;
function onload() {
    components = new BugCountList(document.getElementById('app'));
    if (knownbugs.size) {
        components.renderBugs(Array.from(knownbugs.keys()));
    }
    document.getElementById('expand-list').onclick = function() {
        Array.from(
            document.querySelectorAll('a[role=button]:not([aria-expanded=true])')
        ).forEach(n => n.click());
    };
    document.getElementById('collapse-list').onclick = function() {
        Array.from(
            document.querySelectorAll('a[role=button][aria-expanded=true]')
        ).forEach(n => n.click());
    };
    document.removeEventListener('DOMContentLoaded', onload, true);
}
