const log = console.log.bind(console); // might need a different definition in JSC
const time = Date.now.bind(Date); // might need a different definition in JSC
const autoRun = (typeof window === "undefined"); // if true, auto-runs after loading; or you can call runTest()

////////////////////////////////////////////

const pathMap = {};

// hacked pseudo-require implementation
function require() {
    console.error("didn't expect to be called");
}

function loadModule(path) {
    const module = pathMap[path];
    if (!module.exports) {
        module.exports = {};

        const args = module.reqs.map(req => {
            if (req === "require") return require;
            if (req === "exports") return module.exports;
            return loadModule(req);
        });
        
        module.cbfn.apply(module.cbfn, args);
    }
    return module.exports;
}

function define(path, reqs, cbfn) {
    pathMap[path] = { reqs, cbfn };

    if (path === "index" && autoRun) {
        // start immediately on node
        runTest();
    }
}

function runTest() {
    let module = loadModule("index");
    module.runTest();
}

define("dom/events/Event", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class BaseEvent {
        constructor(type) {
            this.type = type;
        }
    }
    exports.BaseEvent = BaseEvent;
    class EventListener {
        constructor(target, eventType, cbfn) {
            this.target = target;
            this.eventType = eventType;
            this.cbfn = cbfn;
        }
    }
    exports.EventListener = EventListener;
    class ChangeEvent extends BaseEvent {
        constructor(target, property) {
            super("change");
            this.target = target;
            this.property = property;
        }
    }
    exports.ChangeEvent = ChangeEvent;
});
define("common/Matrix2D", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class Matrix2D {
        constructor(a, b, c, d, tx, ty) {
            this.a = a;
            this.b = b;
            this.c = c;
            this.d = d;
            this.tx = tx;
            this.ty = ty;
        }
        encode() {
            return [this.a, this.b, this.c, this.d, this.tx, this.ty].join(",");
        }
        static decode(s) {
            const p = s.split(",").map(x => parseFloat(x));
            return new Matrix2D(p[0], p[1], p[2], p[3], p[4], p[5]);
        }
    }
    exports.Matrix2D = Matrix2D;
    Matrix2D.IDENTITY = new Matrix2D(1, 0, 0, 1, 0, 0);
});
define("render/BaseRenderNode", ["require", "exports", "common/Matrix2D"], function (require, exports, Matrix2D_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class CompositingParams {
        constructor(matrix, opacity) {
            this.matrix = matrix;
            this.opacity = opacity;
        }
    }
    exports.CompositingParams = CompositingParams;
    CompositingParams.DEFAULT = new CompositingParams(Matrix2D_1.Matrix2D.IDENTITY, 1.0);
    class BaseRenderNode {
        constructor(compositing) {
            this.compositing = compositing;
        }
    }
    exports.BaseRenderNode = BaseRenderNode;
});
define("render/NullRenderNode", ["require", "exports", "render/BaseRenderNode"], function (require, exports, BaseRenderNode_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class NullRenderNode extends BaseRenderNode_1.BaseRenderNode {
        constructor() {
            super(BaseRenderNode_1.CompositingParams.DEFAULT);
        }
    }
    exports.NullRenderNode = NullRenderNode;
});
define("dom/BaseGraphicElement", ["require", "exports", "dom/BaseElement", "dom/events/Event", "common/Matrix2D", "render/NullRenderNode"], function (require, exports, BaseElement_1, Event_1, Matrix2D_2, NullRenderNode_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class BaseGraphicElement extends BaseElement_1.BaseElement {
        constructor(type, id) {
            super(type, id);
            this._matrix = Matrix2D_2.Matrix2D.IDENTITY;
        }
        get matrix() {
            return this._matrix;
        }
        set matrix(m) {
            this._matrix = m;
            this.emit(new Event_1.ChangeEvent(this, "matrix"));
        }
        render() {
            return new NullRenderNode_1.NullRenderNode();
        }
        visit(cbfn) {
            if (cbfn(this))
                return this;
            return null;
        }
        write(w) {
            super.write(w);
            w.writeString("matrix", this._matrix.encode());
        }
        read(r) {
            super.read(r);
            this._matrix = Matrix2D_2.Matrix2D.decode(r.readString("matrix"));
        }
    }
    exports.BaseGraphicElement = BaseGraphicElement;
});
define("render/GroupRenderNode", ["require", "exports", "render/BaseRenderNode"], function (require, exports, BaseRenderNode_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class GroupRenderNode extends BaseRenderNode_2.BaseRenderNode {
        constructor(compositing, children) {
            super(compositing);
            this.children = children.concat();
        }
    }
    exports.GroupRenderNode = GroupRenderNode;
});
define("dom/GroupElement", ["require", "exports", "dom/BaseGraphicElement", "dom/events/Event", "render/BaseRenderNode", "render/GroupRenderNode"], function (require, exports, BaseGraphicElement_1, Event_2, BaseRenderNode_3, GroupRenderNode_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class GroupElement extends BaseGraphicElement_1.BaseGraphicElement {
        constructor(id) {
            super(GroupElement.TYPE, id);
            this._children = [];
        }
        addChild(child) {
            this._children.push(child);
            child.parent = this;
            this.emit(new Event_2.ChangeEvent(this, "children/add"));
        }
        removeChild(child) {
            const i = this._children.indexOf(child);
            if (i >= 0) {
                this._children.splice(i, 1);
                child.parent = null;
                this.emit(new Event_2.ChangeEvent(this, "children/remove"));
            }
        }
        forEach(cbfn) {
            this._children.forEach(cbfn);
        }
        map(cbfn) {
            return this._children.map(cbfn);
        }
        visit(cbfn) {
            if (cbfn(this))
                return this;
            for (let i = 0; i < this._children.length; i++) {
                const tmp = this._children[i].visit(cbfn);
                if (tmp)
                    return tmp;
            }
            return null;
        }
        render() {
            return new GroupRenderNode_1.GroupRenderNode(new BaseRenderNode_3.CompositingParams(this.matrix, 1.0), this._children.map(child => child.render()));
        }
        write(w) {
            super.write(w);
            w.writeChildren("children", this._children);
        }
        read(r) {
            super.read(r);
            this._children = r.readChildren("children");
        }
    }
    exports.GroupElement = GroupElement;
    GroupElement.TYPE = "group";
});
define("render/RenderTree", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class RenderTree {
        constructor(root) {
            this.root = root;
        }
    }
    exports.RenderTree = RenderTree;
});
define("dom/Page", ["require", "exports", "dom/BaseElement", "dom/GroupElement", "render/RenderTree"], function (require, exports, BaseElement_2, GroupElement_1, RenderTree_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class Page extends BaseElement_2.BaseElement {
        constructor(id) {
            super(Page.TYPE, id);
            this._root = new GroupElement_1.GroupElement();
            this._root.parent = this;
        }
        get root() {
            return this._root;
        }
        render() {
            return new RenderTree_1.RenderTree(this._root.render());
        }
        write(w) {
            super.write(w);
            w.writeChild("root", this._root);
        }
        read(r) {
            super.read(r);
            this._root = r.readChild("root");
        }
    }
    exports.Page = Page;
    Page.TYPE = "page";
});
define("dom/PageList", ["require", "exports", "dom/BaseElement", "dom/Page", "dom/events/Event"], function (require, exports, BaseElement_3, Page_1, Event_3) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class PageList extends BaseElement_3.BaseElement {
        constructor(id) {
            super(PageList.TYPE, id);
            this._pages = [];
        }
        create() {
            const p = new Page_1.Page();
            this._pages.push(p);
            p.parent = this;
            this.emit(new Event_3.ChangeEvent(this, "pages"));
            return p;
        }
        forEach(cbfn) {
            this._pages.forEach(cbfn);
        }
        map(cbfn) {
            return this._pages.map(cbfn);
        }
        getAt(index) {
            return this._pages[index];
        }
        write(w) {
            super.write(w);
            w.writeChildren("pages", this._pages);
        }
        read(r) {
            super.read(r);
            this._pages = r.readChildren("pages");
        }
    }
    exports.PageList = PageList;
    PageList.TYPE = "page-list";
});
define("dom/ImageElement", ["require", "exports", "dom/BaseGraphicElement", "dom/events/Event"], function (require, exports, BaseGraphicElement_2, Event_4) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class ImageElement extends BaseGraphicElement_2.BaseGraphicElement {
        constructor(id) {
            super(ImageElement.TYPE, id);
            this._url = "";
        }
        get url() {
            return this._url;
        }
        set url(x) {
            this._url = x;
            this.emit(new Event_4.ChangeEvent(this, "url"));
        }
        write(w) {
            super.write(w);
            w.writeString("url", this._url);
        }
        read(r) {
            super.read(r);
            this._url = r.readString("url");
        }
    }
    exports.ImageElement = ImageElement;
    ImageElement.TYPE = "image";
});
define("common/RGBColor", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class RGBColor {
        constructor(red, green, blue) {
            this.red = red;
            this.green = green;
            this.blue = blue;
        }
        encode() {
            return [this.red, this.green, this.blue].join(",");
        }
        static decode(s) {
            const p = s.split(",").map(x => parseFloat(x));
            return new RGBColor(p[0], p[1], p[2]);
        }
    }
    exports.RGBColor = RGBColor;
    RGBColor.BLACK = new RGBColor(0, 0, 0);
    RGBColor.WHITE = new RGBColor(1, 1, 1);
});
define("render/TextRenderNode", ["require", "exports", "render/BaseRenderNode"], function (require, exports, BaseRenderNode_4) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class TextRenderNode extends BaseRenderNode_4.BaseRenderNode {
        constructor(compositing, text, font, size, color) {
            super(compositing);
            this.text = text;
            this.font = font;
            this.size = size;
            this.color = color;
        }
    }
    exports.TextRenderNode = TextRenderNode;
});
define("dom/TextElement", ["require", "exports", "dom/BaseGraphicElement", "dom/events/Event", "common/RGBColor", "render/BaseRenderNode", "render/TextRenderNode"], function (require, exports, BaseGraphicElement_3, Event_5, RGBColor_1, BaseRenderNode_5, TextRenderNode_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class TextElement extends BaseGraphicElement_3.BaseGraphicElement {
        constructor(id) {
            super(TextElement.TYPE, id);
            this._text = "";
            this._font = "";
            this._size = 0;
            this._color = RGBColor_1.RGBColor.BLACK;
        }
        get text() {
            return this._text;
        }
        set text(x) {
            this._text = x;
            this.emit(new Event_5.ChangeEvent(this, "text"));
        }
        get font() {
            return this._font;
        }
        set font(x) {
            this._font = x;
            this.emit(new Event_5.ChangeEvent(this, "font"));
        }
        get size() {
            return this._size;
        }
        set size(x) {
            this._size = x;
            this.emit(new Event_5.ChangeEvent(this, "size"));
        }
        get color() {
            return this._color;
        }
        set color(x) {
            this._color = x;
            this.emit(new Event_5.ChangeEvent(this, "color"));
        }
        render() {
            return new TextRenderNode_1.TextRenderNode(new BaseRenderNode_5.CompositingParams(this.matrix, 1.0), this._text, this._font, this._size, this._color);
        }
        write(w) {
            super.write(w);
            w.writeString("text", this._text);
            w.writeString("font", this._font);
            w.writeNumber("size", this._size);
            w.writeString("color", this._color.encode());
        }
        read(r) {
            super.read(r);
            this._text = r.readString("text");
            this._font = r.readString("font");
            this._size = r.readNumber("size");
            this._color = RGBColor_1.RGBColor.decode(r.readString("color"));
        }
    }
    exports.TextElement = TextElement;
    TextElement.TYPE = "text";
});
define("dom/VideoElement", ["require", "exports", "dom/BaseGraphicElement", "dom/events/Event"], function (require, exports, BaseGraphicElement_4, Event_6) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class VideoElement extends BaseGraphicElement_4.BaseGraphicElement {
        constructor(id) {
            super(VideoElement.TYPE, id);
            this._url = "";
        }
        get url() {
            return this._url;
        }
        set url(x) {
            this._url = x;
            this.emit(new Event_6.ChangeEvent(this, "url"));
        }
        write(w) {
            super.write(w);
            w.writeString("url", this._url);
        }
        read(r) {
            super.read(r);
            this._url = r.readString("url");
        }
    }
    exports.VideoElement = VideoElement;
    VideoElement.TYPE = "video";
});
define("common/Point2D", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class Point2D {
        constructor(x, y) {
            this.x = x;
            this.y = y;
        }
        encode() {
            return [this.x, this.y].join(",");
        }
        static decode(s) {
            const p = s.split(",").map(x => parseFloat(x));
            return new Point2D(p[0], p[1]);
        }
    }
    exports.Point2D = Point2D;
});
define("common/Shape2D", ["require", "exports", "common/Point2D"], function (require, exports, Point2D_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class Shape2D {
        constructor(points) {
            this.points = points.concat();
        }
        reverse() {
            let pts = this.points.concat();
            pts.reverse();
            return new Shape2D(pts);
        }
        encode() {
            return this.points.map(pt => pt.encode()).join(";");
        }
        static decode(s) {
            const pts = s.split(";").map(s2 => Point2D_1.Point2D.decode(s2));
            return new Shape2D(pts);
        }
    }
    exports.Shape2D = Shape2D;
    Shape2D.EMPTY = new Shape2D([]);
});
define("render/ShapeRenderNode", ["require", "exports", "render/BaseRenderNode"], function (require, exports, BaseRenderNode_6) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class ShapeRenderNode extends BaseRenderNode_6.BaseRenderNode {
        constructor(compositing, shape, color) {
            super(compositing);
            this.shape = shape;
            this.color = color;
        }
    }
    exports.ShapeRenderNode = ShapeRenderNode;
});
define("dom/ShapeElement", ["require", "exports", "dom/BaseGraphicElement", "dom/events/Event", "common/Shape2D", "common/RGBColor", "render/BaseRenderNode", "render/ShapeRenderNode"], function (require, exports, BaseGraphicElement_5, Event_7, Shape2D_1, RGBColor_2, BaseRenderNode_7, ShapeRenderNode_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class ShapeElement extends BaseGraphicElement_5.BaseGraphicElement {
        constructor(id) {
            super(ShapeElement.TYPE, id);
            this._shape = Shape2D_1.Shape2D.EMPTY;
            this._color = RGBColor_2.RGBColor.BLACK;
        }
        get shape() {
            return this._shape;
        }
        set shape(x) {
            this._shape = x;
            this.emit(new Event_7.ChangeEvent(this, "shape"));
        }
        get color() {
            return this._color;
        }
        set color(x) {
            this._color = x;
            this.emit(new Event_7.ChangeEvent(this, "color"));
        }
        render() {
            return new ShapeRenderNode_1.ShapeRenderNode(new BaseRenderNode_7.CompositingParams(this.matrix, 1.0), this._shape, this._color);
        }
        write(w) {
            super.write(w);
            w.writeString("shape", this._shape.encode());
        }
        read(r) {
            super.read(r);
            this._shape = Shape2D_1.Shape2D.decode(r.readString("shape"));
        }
    }
    exports.ShapeElement = ShapeElement;
    ShapeElement.TYPE = "shape";
});
define("dom/Persistence", ["require", "exports", "dom/Dokument", "dom/PageList", "dom/Page", "dom/GroupElement", "dom/ImageElement", "dom/TextElement", "dom/VideoElement", "dom/ShapeElement"], function (require, exports, Dokument_1, PageList_1, Page_2, GroupElement_2, ImageElement_1, TextElement_1, VideoElement_1, ShapeElement_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class ElementWriter {
        constructor() {
            this.data = {};
        }
        writeType(value) {
            this.data["type"] = value;
        }
        writeString(prop, value) {
            this.data[prop] = value;
        }
        writeNumber(prop, value) {
            this.data[prop] = value;
        }
        writeChild(prop, value) {
            const subwriter = new ElementWriter();
            value.write(subwriter);
            this.data[prop] = subwriter.data;
        }
        writeChildren(prop, value) {
            const children = [];
            this.data[prop] = value.map(child => {
                const subwriter = new ElementWriter();
                child.write(subwriter);
                children.push(subwriter.data);
            });
            this.data[prop] = children;
        }
    }
    exports.ElementWriter = ElementWriter;
    class ElementReader {
        constructor(elem, data) {
            this.elem = elem;
            this.data = data;
        }
        static setupFactory() {
            const f = {};
            f[Dokument_1.Dokument.TYPE] = (id) => new Dokument_1.Dokument(id);
            f[PageList_1.PageList.TYPE] = (id) => new PageList_1.PageList(id);
            f[Page_2.Page.TYPE] = (id) => new Page_2.Page(id);
            f[GroupElement_2.GroupElement.TYPE] = (id) => new GroupElement_2.GroupElement(id);
            f[ImageElement_1.ImageElement.TYPE] = (id) => new ImageElement_1.ImageElement(id);
            f[TextElement_1.TextElement.TYPE] = (id) => new TextElement_1.TextElement(id);
            f[VideoElement_1.VideoElement.TYPE] = (id) => new VideoElement_1.VideoElement(id);
            f[ShapeElement_1.ShapeElement.TYPE] = (id) => new ShapeElement_1.ShapeElement(id);
            return f;
        }
        readString(prop) {
            return this.data[prop];
        }
        readNumber(prop) {
            return this.data[prop];
        }
        readChild(prop) {
            const elem = ElementReader.factory[this.data[prop].type](this.data.id);
            const subreader = new ElementReader(elem, this.data[prop]);
            elem.read(subreader);
            elem.parent = this.elem;
            return elem;
        }
        readChildren(prop) {
            const children = this.data[prop];
            const elems = [];
            children.forEach(child => {
                const elem = ElementReader.factory[child.type](child.id);
                const subreader = new ElementReader(elem, child);
                elem.read(subreader);
                elem.parent = this.elem;
                elems.push(elem);
            });
            return elems;
        }
    }
    exports.ElementReader = ElementReader;
    ElementReader.factory = ElementReader.setupFactory();
});
define("dom/BaseElement", ["require", "exports", "dom/events/Event"], function (require, exports, Event_8) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class BaseElement {
        constructor(type, id) {
            this.type = type;
            this.id = id || `X${BaseElement.nextID++}`;
            this._listeners = [];
            this._parent = null;
        }
        get parent() {
            return this._parent;
        }
        set parent(p) {
            this._parent = p;
            this.emit(new Event_8.ChangeEvent(this, "parent"));
        }
        addEventListener(eventType, cbfn) {
            const el = new Event_8.EventListener(this, eventType, cbfn);
            this._listeners.push(el);
            return el;
        }
        emit(event) {
            var _a;
            this._listeners.forEach(listener => listener.cbfn(event));
            (_a = this.parent) === null || _a === void 0 ? void 0 : _a.emit(event);
        }
        removeEventListener(listener) {
            const index = this._listeners.indexOf(listener);
            if (index >= 0)
                this._listeners.splice(index, 1);
        }
        write(w) {
            w.writeType(this.type);
            w.writeString("id", this.id);
        }
        read(r) {
        }
    }
    exports.BaseElement = BaseElement;
    BaseElement.nextID = 1;
});
define("dom/Dokument", ["require", "exports", "dom/BaseElement", "dom/PageList", "dom/events/Event"], function (require, exports, BaseElement_4, PageList_2, Event_9) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class Dokument extends BaseElement_4.BaseElement {
        constructor(id) {
            super(Dokument.TYPE, id);
            this._pageList = new PageList_2.PageList();
            this._name = "New Document";
            this._pageList.parent = this;
        }
        get name() {
            return this._name;
        }
        set name(x) {
            this._name = x;
            this.emit(new Event_9.ChangeEvent(this, "name"));
        }
        get pages() {
            return this._pageList;
        }
        write(w) {
            super.write(w);
            w.writeString("name", this._name);
            w.writeChild("page-list", this._pageList);
        }
        read(r) {
            super.read(r);
            this._name = r.readString("name");
            this._pageList = r.readChild("page-list");
        }
    }
    exports.Dokument = Dokument;
    Dokument.TYPE = "document";
});
define("index", ["require", "exports", "dom/Dokument", "dom/ImageElement", "dom/Persistence", "common/Matrix2D", "dom/TextElement", "common/RGBColor", "dom/GroupElement", "dom/ShapeElement", "common/Shape2D", "common/Point2D"], function (require, exports, Dokument_2, ImageElement_2, Persistence_1, Matrix2D_3, TextElement_2, RGBColor_3, GroupElement_3, ShapeElement_2, Shape2D_2, Point2D_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function reverseZOrder(group) {
        const elements = group.map(elem => elem);
        elements.forEach(elem => group.removeChild(elem));
        for (let i = elements.length - 1; i >= 0; i--) {
            const elem = elements[i];
            if (elem instanceof GroupElement_3.GroupElement) {
                reverseZOrder(elem);
            }
            group.addChild(elem);
        }
    }
    function reverseShapeOrder(group) {
        group.visit(elem => {
            if (elem instanceof ShapeElement_2.ShapeElement) {
                elem.shape = elem.shape.reverse();
            }
            return false;
        });
    }
    function processDocument(doc) {
        // find all the text elements
        const texts = [];
        doc.pages.forEach(page => {
            reverseZOrder(page.root);
        });
        let trees = [];
        trees = doc.pages.map(pg => pg.render());
        doc.pages.forEach(page => {
            page.root.visit(elem => {
                if (elem instanceof TextElement_2.TextElement) {
                    texts.push(elem);
                }
                return false;
            });
            reverseShapeOrder(page.root);
        });
        texts.forEach(t => {
            t.parent.removeChild(t);
        });
        trees = doc.pages.map(pg => pg.render());
        return trees.length;
    }
    function runTest() {
        const TEST_COUNT = 10;
        const times = [];
        for (let docIndex = 0; docIndex < TEST_COUNT; docIndex++) {
            let changeEvents = [];
            const t1 = time();
            const doc = new Dokument_2.Dokument();
            doc.addEventListener("change", evt => {
                changeEvents.push(evt);
            });
            const addThingsToGroup = (grp) => {
                const img = new ImageElement_2.ImageElement();
                grp.addChild(img);
                img.url = "adobe.com/foo";
                img.matrix = new Matrix2D_3.Matrix2D(2, 0, 0, 2, 10, 10);
                const vid = new ImageElement_2.ImageElement();
                grp.addChild(vid);
                vid.url = "adobe.com/bar";
                vid.matrix = new Matrix2D_3.Matrix2D(2, 0, 0, 2, 10, 10);
                const shp = new ShapeElement_2.ShapeElement();
                grp.addChild(shp);
                shp.shape = new Shape2D_2.Shape2D([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => new Point2D_2.Point2D(n, n)));
                shp.color = new RGBColor_3.RGBColor(0, 0, 1);
                const txt = new TextElement_2.TextElement();
                grp.addChild(txt);
                txt.text = "hello world";
                txt.font = "Arial";
                txt.color = new RGBColor_3.RGBColor(1, 0, 0);
                txt.matrix = new Matrix2D_3.Matrix2D(3, 0, 0, 3, 20, 10);
            };
            const addGroupRecursive = (depth, width, toGroup) => {
                if (depth == 0)
                    return;
                for (let i = 0; i < width; i++) {
                    const grp = new GroupElement_3.GroupElement();
                    toGroup.addChild(grp);
                    addThingsToGroup(grp);
                    addGroupRecursive(depth - 1, width, grp);
                }
            };
            for (let i = 0; i < 100; i++) {
                const p1 = doc.pages.create();
                addGroupRecursive(3, 4, p1.root);
            }
            const w1 = new Persistence_1.ElementWriter();
            doc.write(w1);
            let json1 = w1.data;
            processDocument(doc);
            const w2 = new Persistence_1.ElementWriter();
            doc.write(w2);
            let json2 = w2.data;
            const t2 = time();
            times.push(t2 - t1);
            if (docIndex == TEST_COUNT - 1) {
                log("Times: " + times.join(", ") + " mean=" + (times.reduce((sum, x) => sum + x, 0) / TEST_COUNT).toFixed(1));
                const summary = {};
                changeEvents.forEach(evt => {
                    const key = evt.target.type + ":" + evt.property;
                    if (summary[key])
                        summary[key]++;
                    else
                        summary[key] = 1;
                });
                log("Summary (for the last test only)");
                log("Events:");
                for (let prop in summary) {
                    log(`-- ${prop}: ${summary[prop]}`);
                }
                log(Math.round(JSON.stringify(json1).length / 1000) + "K of JSON before processing");
                log(Math.round(JSON.stringify(json2).length / 1000) + "K of JSON after processing");
            }
        }
    }
    exports.runTest = runTest;
});
