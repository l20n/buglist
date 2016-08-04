/* global $, knownbugs, tracker, Viz */
"use strict";

document.addEventListener('bug-data', ondata, true);
document.addEventListener('DOMContentLoaded', onload, true);
if (!document.location.hash) {
    document.location.hash = 'components';
}
window.onhashchange = update_active;
function update_active() {
    var navbar = document.querySelector('.navbar-nav');
    var hash = document.location.hash;
    Array.from(navbar.children).forEach(function(li) {
        if (li.children[0].getAttribute('href') === hash) {
            li.classList.add('active');
        }
        else {
            li.classList.remove('active');
        }
    });
}

function ondata(e) {
    components && components.renderBugs(e.detail.newbugs);
    people && people.renderBugs(e.detail.newbugs);
}

function sortBugs(a, b) {
    if (b.depends_on.length !== a.depends_on.length) {
        return a.depends_on.length  - b.depends_on.length;
    }
    return b.blocks.length - a.blocks.length;
}

class BugRow {
    constructor(bug, mount, before) {
        this._bug = bug;
        this._sort = !!before;
        var cell, bug_html = document.querySelector('#templates > .bug_template').cloneNode(true);
        this.dom = bug_html;
        this.dom.bug = bug;
        bug_html.querySelector('.id').textContent = bug.id;
        bug_html.querySelector('a').setAttribute('href', 'https://bugzil.la/' + bug.id);
        bug_html.querySelector('.summary').textContent = bug.summary;
        if (bug.assigned_to !== 'nobody@mozilla.org') {
            bug_html.querySelector('.assigned_to').textContent = bug.assigned_to;
        }
        this.renderDeps();
        var blocks = bug.blocks;
        if (blocks && blocks.length && tracker && blocks.indexOf(tracker) >= 0) {
            blocks.splice(blocks.indexOf(tracker), 1);
        }
        if (bug.blocks && bug.blocks.length) {
            cell = bug_html.querySelector('.blocks');
            cell.classList.add('bg-warning');
            cell.textContent = bug.blocks.length;
        }
        else {
            bug_html.querySelector('.blocks').remove();
        }
        if (bug.resolution === 'FIXED') {
            bug_html.classList.add('fixed');
        }
        mount.insertBefore(bug_html, before);
        document.addEventListener('bug-dependencies-' + bug.id,
                                  this.renderDeps.bind(this), true);
    }

    renderDeps(e) {
        var cell;
        if (this._bug.depends_on && this._bug.depends_on.length) {
            cell = this.dom.querySelector('.depends_on');
            cell.classList.add('bg-danger');
            cell.textContent = this._bug.depends_on.length;
        }
        else {
            this.dom.querySelector('.depends_on').remove();
        }
        if (this._sort && this.dom.parentNode) {
            var before = this.dom;
            while (before.previousSibling && sortBugs(before.previousSibling.bug, this._bug) > 0) {
                before = before.previousSibling;
            }
            if (before !== this.dom) {
                this.dom.parentElement.insertBefore(this.dom, before);
            }
        }
    }
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
        new BugRow(bug, this._dom.querySelector('.bugs'));
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


class People {
    constructor(mount) {
        this.mount = mount;
        while (mount.lastChild) {
            mount.lastChild.remove();
        }
        this._map = new Map();
    }
    get(bug) {
        var key = bug.assigned_to.replace(/^W/g, '_');
        var person = this._map.get(key);
        if (!person) {
            person = new Person(key, bug.assigned_to_detail, this.mount);
            this._map.set(key, person);
        }
        return person;
    }
    renderBugs(newbugs) {
        if (newbugs.length == 0) return;
        var rerender = new Set();
        newbugs.forEach(function(bugid) {
            var bug = knownbugs.get(bugid);
            var person = this.get(bug);
            person.add(bug);
            rerender.add(person);
        }, this);
        rerender.forEach(person => person.render());
    }
}

class Person {
    constructor(id, detail, mount) {
        this._id = id;
        this.detail = detail;
        this.depends_on = new Set();
        this.blocks = new Set();
        this.fixed = 0;
        this.buglist = [];
        this._dom = document.querySelector('#templates > .people-person').cloneNode(true);
        this._dom.id = id;
        this._dom.querySelector('.name').textContent = detail.email==='nobody@mozilla.org' ? 'Unassigned' : detail.name;
        var child = null;
        for (var i=0, ii=mount.children.length; i<ii; ++i) {
            if (mount.children[i].id > this._dom.id) {
                child = mount.children[i];
                break;
            }
        }
        mount.insertBefore(this._dom, child);
    }
    add(assigned_bug) {
        if (assigned_bug.resolution === 'FIXED') {
            this.fixed++;
            return;
        }
        assigned_bug.depends_on.forEach(function(bug) {
            bug = knownbugs.get(bug);
            if (!bug) {
                this.depends_on.add('nobody@mozilla.org');
            }
            else if (bug.resolution ==='') {
                this.depends_on.add(bug.assigned_to);
            }
        }, this);
        assigned_bug.blocks.forEach(function(bug) {
            bug = knownbugs.get(bug);
            if (!bug) {
                this.blocks.add('nobody@mozilla.org');
            }
            else if (bug.resolution ==='') {
                this.blocks.add(bug.assigned_to);
            }
        }, this);
        if (assigned_bug.depends_on.length) {
            document.addEventListener('bug-dependencies-' + assigned_bug.id,
                                      this.updateDeps.bind(this), true);
        }
        this.buglist.push(assigned_bug);
        this.buglist.sort(sortBugs);
    }
    render() {
        this._dom.querySelector('.fixed').textContent = this.fixed;
        var bugnode = this._dom.querySelector('.bugs').firstChild;
        this.buglist.forEach(function(bug) {
            var id = 'person_bug_' + bug.id;
            if (bugnode && bugnode.id === id) {
                bugnode = bugnode.nextSibling;
                return;
            }
            var bugrow = new BugRow(bug, this._dom.querySelector('.bugs'), bugnode);
            bugrow.dom.id = id;
            bugnode = bugrow.dom.nextSibling;
        }, this);
    }
    updateDeps(e) {
        var bug = knownbugs.get(e.detail.id);
        var oldpos = this.buglist.indexOf(bug);
        this.buglist.sort(sortBugs);
        var newpos = this.buglist.indexOf(bug);
        if (newpos === oldpos) {
            return;
        }
        var bugnode = document.getElementById('person_bug_' + bug.id);
        var sibling = bugnode.parentElement.children[newpos];
        bugnode.parentElement.insertBefore(bugnode, sibling);
    }
}

class Graph {
    constructor() {
        var arcs = [], nodes = [];
        this.nodes = nodes;
        knownbugs.forEach(function(bug) {
            if (bug.resolution === 'FIXED') return;
            bug.blocks.forEach(function(id) {
                arcs.push(bug.id + '->' + id + ';');
            });
            nodes.push(bug.id + ' [ tooltip = "' + bug.summary.replace(/"/g, '\\"') + '" ' +
            ((bug.tags.indexOf('gecko-l20n') >=0 && bug.tags.indexOf('feature') >=0 ) ? 'color = "blue" ' : '') +
            'URL = "https://bugzil.la/' + bug.id + '"] ;');
        });
        try {
        this.viz = Viz("digraph \"\" { \n  rankdir = LR;\n" +
            nodes.join("\n") + 
            arcs.join("\n") +
        " }");
        } catch (e) {console.log(e)}
        this.dom = $("#graph").html(this.viz);
    }
}

var components, people;
function onload() {
    components = new BugCountList(document.getElementById('app'));
    people = new People(document.getElementById('people'));
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
    update_active();
    document.removeEventListener('DOMContentLoaded', onload, true);
}
