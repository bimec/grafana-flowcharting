import { Flowchart } from 'flowchart_class';
import { Rule, GFMap } from 'rule_class';
import _ from 'lodash';
import { Metric } from './metric_class';
import { $GF } from 'globals_class';

/**
 * Class FlowchartHandler
 */
export class FlowchartHandler {
  $scope: ng.IScope;
  $elem: any; //TODO: elem ?
  parentDiv: HTMLDivElement;
  ctrl: any; //TODO: ctrl ?
  flowcharts: Flowchart[] = [];
  currentFlowchartName = 'Main'; // name of current Flowchart
  currentFlowchart: Flowchart | undefined;
  data: gf.TFlowchartHandlerData;
  firstLoad = true; // First load
  flags = {
    sources: new Set<string>(),
    options: new Set<string>(),
    rules: new Set<string>(),
    datas: new Set<string>(),
    graphHover: new Set<string>(),
    applyOptions: new Set<string>(),
    hiddenChange: new Set<string>(),
  };
  // changeSourceFlag: Set<string> = new Set<string>(); // Source changed
  // changeOptionFlag: Set<string> = new Set<string>(); // Options changed
  // changeDataFlag = false; // Data changed
  // changeGraphHoverFlag = false; // Graph Hover
  // changeRuleFlag = false; // rules changed
  newMode = false; // Mode if new flowchart
  sequenceNumber = 0; // Sequence Number for a name
  static defaultXml: string;
  static defaultCsv: string;
  onMapping: gf.TIOnMappingObj = {
    active: false,
    object: null,
    value: null,
    prop: 'id',
    $scope: null,
  };
  mousedownTimeout = 0;
  mousedown = 0;
  onEdit = false; // editor open or not
  postedId: string | undefined = undefined; // Current ID on edit mode
  editorWindow: Window | null = null; // Window draw.io editor

  /**
   * Creates an instance of FlowchartHandler to handle flowchart
   * @param {ng.IScope} $scope - angular scope
   * @param {any} elem - angular elem
   * @param {TODO:FlowchartCtrl} ctrl - ctrlPanel
   * @param {*} data - Empty data to store
   * @memberof FlowchartHandler
   */
  constructor($scope: ng.IScope, elem: any, ctrl: any, data: gf.TFlowchartHandlerData) {
    FlowchartHandler.getDefaultDioGraph();
    this.$scope = $scope;
    this.$elem = elem.find('.flowchart-panel__chart');
    this.parentDiv = this.$elem[0];
    this.ctrl = ctrl;
    this.data = data;
    this.currentFlowchartName = this.data.main;

    // Events Render
    ctrl.events.on('render', () => {
      this.render();
    });

    document.body.onmousedown = () => {
      this.mousedown = 0;
      window.clearInterval(this.mousedownTimeout);
      this.mousedownTimeout = window.setInterval(() => {
        this.mousedown += 1;
      }, 200);
    };

    document.body.onmouseup = () => {
      this.mousedown = 0;
      window.clearInterval(this.mousedownTimeout);
    };
  }

  static getDefaultData(): gf.TFlowchartHandlerData {
    return {
      editorUrl: 'https://www.draw.io',
      editorTheme: 'kennedy',
      main: 'Main',
      flowcharts: [],
    };
  }

  /**
   * import data into
   *
   * @returns {this}
   * @param {Object} obj
   * @memberof FlowchartHandler
   */
  import(obj: any): this {
    this.flowcharts = [];
    if (obj !== undefined && obj !== null) {
      // For version 0.5.0 and under
      let tmpFc: gf.TFlowchartData[];
      if (Array.isArray(obj)) {
        tmpFc = obj;
      } else {
        tmpFc = obj.flowcharts;
      }

      // For 0.9.0 and under
      if (tmpFc.length === 1) {
        this.data.main = tmpFc[0].name;
        this.currentFlowchartName = this.data.main;
        this.data.editorTheme = tmpFc[0].editorTheme;
        this.data.editorUrl = tmpFc[0].editorUrl;
      }
      this.data.editorTheme = !!obj.editorTheme ? obj.editorTheme : this.data.editorTheme;
      this.data.editorUrl = !!obj.editorUrl ? obj.editorUrl : this.data.editorUrl;

      // import data
      tmpFc.forEach((fcData: gf.TFlowchartData) => {
        const container = this.createContainer();
        const newData = Flowchart.getDefaultData();
        const fc = new Flowchart(fcData.name, container, this.ctrl, newData);
        fc.import(fcData);
        this.flowcharts.push(fc);
        this.data.flowcharts.push(newData);
      });
      this.currentFlowchart = this.getFlowchart(this.data.main);
    }
    return this;
  }

  /**
   * Return default xml source graph
   *
   * @static
   * @returns {string}
   * @memberof FlowchartHandler
   */
  static getDefaultDioGraph(): string {
    let result = FlowchartHandler.defaultXml;
    if (!result) {
      const url = `${$GF.plugin.getRootPath()}${$GF.CONSTANTS.CONF_FILE_DEFAULTDIO}`;
      result = $GF.utils.$loadFile(url);
    }
    return result;
  }

  /**
   * Return default xml source graph
   *
   * @static
   * @returns {string}
   * @memberof FlowchartHandler
   */
  static getDefaultCsvGraph(): string {
    let result = FlowchartHandler.defaultCsv;
    if (!result) {
      const url = `${$GF.plugin.getRootPath()}${$GF.CONSTANTS.CONF_FILE_DEFAULTCSV}`;
      result = $GF.utils.$loadFile(url);
    }
    return result;
  }

  /**
   * Get flowchart with name
   *
   * @param {string} name
   * @returns {Flowchart}
   * @memberof FlowchartHandler
   */
  getFlowchart(name?: string): Flowchart {
    if (name) {
      const lg = this.flowcharts.length;
      for (let i = 0; i < lg; i++) {
        const fc = this.flowcharts[i];
        if (fc.getName() === name) {
          return fc;
        }
      }
    }
    const current = this.getCurrentFlowchart();
    return current !== undefined ? current : this.flowcharts[0];
  }

  getFlowchartById(id: string): Flowchart | undefined {
    const fcs = this.getFlowcharts();
    for (let index = 0; index < fcs.length; index++) {
      const fc = fcs[index];
      if (fc.id === id) {
        return fc;
      }
    }
    return undefined;
  }

  /**
   * Return array of flowchart
   *
   * @returns {Flowchart[]} Array of flowchart
   * @memberof FlowchartHandler
   */
  getFlowcharts(): Flowchart[] {
    return this.flowcharts;
  }

  /**
   * Return number of flowchart
   *
   * @returns {number} Nulber of flowchart
   * @memberof FlowchartHandler
   */
  countFlowcharts(): number {
    if (this.flowcharts !== undefined && Array.isArray(this.flowcharts)) {
      return this.flowcharts.length;
    }
    return 0;
  }

  /**
   * get a temp name
   *
   * @returns {string}
   * @memberof FlowchartHandler
   */
  getFlowchartTmpName(): string {
    if (this.sequenceNumber === 0) {
      this.sequenceNumber = this.countFlowcharts();
    }
    return `Flowchart-${this.sequenceNumber++}`;
  }

  /**
   * Define current flowchart to display
   *
   * @param {string} name, Main if empty
   * @returns {(Flowchart|undefined)}
   * @memberof FlowchartHandler
   */
  setCurrentFlowchart(name?: string): Flowchart | undefined {
    if (name === undefined) {
      this.currentFlowchart = this.getFlowchart('Main');
      this.currentFlowchartName = this.currentFlowchart.getName();
      this.currentFlowchart.toFront();
      return this.currentFlowchart;
    }
    if (this.currentFlowchart === undefined) {
      this.currentFlowchart = this.getFlowchart(name);
      this.currentFlowchartName = this.currentFlowchart.getName();
      this.currentFlowchart.toFront();
      return this.currentFlowchart;
    }
    if (this.currentFlowchart.getName() !== name) {
      this.currentFlowchart.toBack();
      this.currentFlowchart = this.getFlowchart(name);
      this.currentFlowchartName = name;
      this.currentFlowchart.toFront();
    }
    return this.currentFlowchart;
  }

  /**
   * get Current Flowchart
   *
   * @returns {(Flowchart|undefined)}
   * @memberof FlowchartHandler
   */
  getCurrentFlowchart(): Flowchart | undefined {
    return this.currentFlowchart;
  }

  /**
   * Give the name of current flowchart
   *
   * @returns {string}
   * @memberof FlowchartHandler
   */
  getCurrentFlowchartName(): string {
    const cf = this.getCurrentFlowchart();
    return cf !== undefined ? cf.getName() : 'Main';
  }

  /**
   * Create a div container for graph
   *
   * @returns {HTMLDivElement}
   * @memberof FlowchartHandler
   */
  createContainer(): HTMLDivElement {
    const div = document.createElement('div');
    div.style.margin = 'auto';
    div.style.position = 'relative';
    div.style.width = '100%';
    div.style.height = '100%';
    div.style.touchAction = 'none';
    div.style.border = 'none';
    div.style.cursor = 'default';
    div.style.right = '0px';
    div.style.left = '0px';
    div.style.bottom = '0px';
    div.style.top = '0px';
    // div.style.overflow = 'none';
    this.parentDiv.appendChild(div);
    return div;
  }

  /**
   * Add a flowchart
   *
   * @param {string} name
   * @returns {Flowchart}
   * @memberof FlowchartHandler
   */
  addFlowchart(name: string): Flowchart {
    const trc = $GF.trace.before(this.constructor.name + '.' + 'addFlowchart()');
    const container = this.createContainer();
    const data = Flowchart.getDefaultData();
    const flowchart = new Flowchart(name, container, this.ctrl, data);
    flowchart.init();
    this.data.flowcharts.push(data);
    this.flowcharts.push(flowchart);
    this.flagChange($GF.CONSTANTS.FLOWCHART_CHG_SOURCES, name);
    trc.after();
    return flowchart;
  }

  /**
   * Remove a flowchart
   *
   * @param {string} name
   * @memberof FlowchartHandler
   */
  removeFlowchart(name: string) {
    const trc = $GF.trace.before(this.constructor.name + '.' + 'removeFlowchart()');
    const fc = this.getFlowchart(name);
    const index = this.flowcharts.indexOf(fc);
    this.flowcharts.splice(index, 1);
    this.data.flowcharts.splice(index, 1);
    fc.destroy();
    trc.after();
  }

  /**
   * Render for draw
   *
   * @memberof FlowchartHandler
   */
  async render(name?: string) {
    const trc = $GF.trace.before(this.constructor.name + '.' + 'render()');
    console.log('Flags',this.flags);
    debugger
    // not repeat render if mouse down
    if (!this.mousedown) {
      const self = this;
      // SOURCE
      if (self.isFlagedChange($GF.CONSTANTS.FLOWCHART_CHG_SOURCES)) {
        this.getFlagNames($GF.CONSTANTS.FLOWCHART_CHG_SOURCES).forEach(name => {
          self.load(name).setOptions(name);
        });
      }

      // OPTIONS
      if (self.isFlagedChange($GF.CONSTANTS.FLOWCHART_CHG_OPTIONS)) {
        this.getFlagNames($GF.CONSTANTS.FLOWCHART_CHG_OPTIONS).forEach(name => {
          self.setOptions(name);
        });
      }

      // RULES or DATAS
      if (
        self.isFlagedChange($GF.CONSTANTS.FLOWCHART_CHG_RULES) ||
        self.isFlagedChange($GF.CONSTANTS.FLOWCHART_CHG_DATAS) ||
        self.isFlagedChange($GF.CONSTANTS.FLOWCHART_CHG_GRAPHHOVER)
      ) {
        const rules = self.ctrl.rulesHandler.getRules();
        const metrics = self.ctrl.metricHandler.getMetrics();

        // Change to async to optimize
        self.async_refreshStates(rules, metrics);

      }
      // OTHER : Resize, OnLoad
      if (self.isFlagedChange($GF.CONSTANTS.FLOWCHART_APL_OPTIONS) || self.firstLoad) {
        this.getFlagNames($GF.CONSTANTS.FLOWCHART_APL_OPTIONS).forEach(name => {
          self.applyOptions(name);
        });
        
        self.firstLoad = false;
      }
      // this.refresh();
    }
    this.ctrl.renderingCompleted();
    trc.after();
  }

  /**
   * Flag source change
   *
   * @returns {this}
   * @memberof FlowchartHandler
   */
  onSourceChange(name?: string): this {
    this.flagChange($GF.CONSTANTS.FLOWCHART_CHG_SOURCES, name);
    return this;
  }

  /**
   * Flag options change
   *
   * @param {string} [name]
   * @returns {this}
   * @memberof FlowchartHandler
   */
  onOptionsChange(name?: string): this {
    this.flagChange($GF.CONSTANTS.FLOWCHART_CHG_OPTIONS, name);
    return this;
  }

  /**
   * Flag datas change
   *
   * @param {string} [name]
   * @returns {this}
   * @memberof FlowchartHandler
   */
  onDatasChange(name?: string): this {
    this.flagChange($GF.CONSTANTS.FLOWCHART_CHG_DATAS, name);
    return this;
  }

  /**
   * Flag rule change
   *
   * @returns {this}
   * @memberof FlowchartHandler
   */
  onRulesChange(name?: string): this {
    this.flagChange($GF.CONSTANTS.FLOWCHART_CHG_RULES, name);
    return this;
  }

  /**
   * Flag data Graph-Hover change
   *
   * @returns {this}
   * @memberof FlowchartHandler
   */
  onGraphHoverChange(): this {
    this.flagChange($GF.CONSTANTS.FLOWCHART_CHG_GRAPHHOVER, name);
    return this;
  }

  /**
   * Apply options on graphs
   *
   * @returns {this}
   * @memberof FlowchartHandler
   */
  applyOptions(name?: string): this {
    const trc = $GF.trace.before(this.constructor.name + '.' + 'applyOptions()');
    if (name === undefined) {
      this.flowcharts.forEach(flowchart => {
        const name = flowchart.getName();
        this.applyOptions(name);
      });
    } else {
      const flowchart = this.getFlowchart(name);
      flowchart.applyOptions();
      this.aknowledgeFlagChange($GF.CONSTANTS.FLOWCHART_CHG_OPTIONS, name);
      if (!flowchart.isVisible()) {
        this.flagChange($GF.CONSTANTS.FLOWCHART_CHG_HIDDENCHANGE, name);
      }
    }
    trc.after();
    return this;
  }

  flagChange(type: gf.TFlowchartFlagKeys, name?: string): this {
    if (name !== undefined) {
      this.flags[type].add(name);
    } else {
      this.flowcharts.forEach(flowchart => {
        const name = flowchart.getName();
        this.flags[type].add(name);
      });
    }
    return this;
  }

  isFlagedChange(type: gf.TFlowchartFlagKeys, name?: string): boolean {
    if (name === undefined) {
      return this.flags[type].size > 0;
    }
    return this.flags[type].has(name);
  }

  aknowledgeFlagChange(type: gf.TFlowchartFlagKeys, name?: string): void {
    if (name === undefined) {
      this.flags[type].clear();
    } else {
      this.flags[type].delete(name);
    }
  }

  getFlagNames(type: gf.TFlowchartFlagKeys): string[] {
    let result: string[] = [];
    this.flags[type].forEach(value => result.push(value));
    return result;
  }

  /**
   * Call refreshStates asynchronously
   *
   * @param {Rule[]} rules
   * @param {Metric[]} metrics
   * @memberof FlowchartHandler
   */
  async_refreshStates(rules: Rule[], metrics: Metric[]) {
    const trc = $GF.trace.before(this.constructor.name + '.' + 'async_refreshStates()');
    this.refreshStates(rules, metrics);
    trc.after();
  }

  /**
   * Refresh rules according new rules or data
   *
   * @param {Rule[]} rules
   * @param {Metric[]} metrics
   * @returns {this}
   * @memberof FlowchartHandler
   */
  refreshStates(rules: Rule[], metrics: Metric[]): this {
    const trc = $GF.trace.before(this.constructor.name + '.' + 'refreshStates()');
    if (this.isFlagedChange($GF.CONSTANTS.FLOWCHART_CHG_RULES)) {
      this.updateStates(rules);
      this.aknowledgeFlagChange($GF.CONSTANTS.FLOWCHART_CHG_RULES);
    }
    this.setStates(rules, metrics);
    this.applyStates();
    trc.after();
    return this;
  }

  /**
   * Refresh all flowchart
   *
   * @returns {this}
   * @memberof FlowchartHandler
   */
  refresh(): this {
    this.flowcharts.forEach(flowchart => {
      flowchart.refresh();
    });
    return this;
  }

  /**
   * Change states of cell according to rules and metrics
   *
   * @param {Rule[]} rules
   * @param {any[]} metrics
   * @returns {this}
   * @memberof FlowchartHandler
   */
  setStates(rules: Rule[], metrics: any[]): this {
    const trc = $GF.trace.before(this.constructor.name + '.' + 'setStates()');
    this.flowcharts.forEach(flowchart => {
      flowchart.setStates(rules, metrics);
    });
    trc.after();
    return this;
  }

  /**
   * Update states with rule
   *
   * @param {Rule[]} rules
   * @returns {this}
   * @memberof FlowchartHandler
   */
  updateStates(rules: Rule[]): this {
    const trc = $GF.trace.before(this.constructor.name + '.' + 'updateStates()');
    this.flowcharts.forEach(flowchart => {
      flowchart.updateStates(rules);
    });
    trc.after();
    return this;
  }

  /**
   * Apply state of cell after setStates
   *
   * @returns {this}
   * @memberof FlowchartHandler
   */
  applyStates(): this {
    const trc = $GF.trace.before(this.constructor.name + '.' + 'applyStates()');
    new Promise(() => {
      this.flowcharts.forEach(flowchart => {
        flowchart.applyStates();
      });
    }).then(() => {
      this.refresh();
    });
    trc.after();
    return this;
  }

  /**
   * Set and apply options
   *
   * @returns {this}
   * @memberof FlowchartHandler
   */
  setOptions(name?: string): this {
    const trc = $GF.trace.before(this.constructor.name + '.' + 'setOptions()');
    if (name === undefined) {
      this.flowcharts.forEach(flowchart => {
        const name = flowchart.getName();
        this.setOptions(name);
      });
    } else {
      const flowchart = this.getFlowchart(name);
      flowchart.setOptions();
      this.aknowledgeFlagChange($GF.CONSTANTS.FLOWCHART_CHG_OPTIONS, name);
      this.flagChange($GF.CONSTANTS.FLOWCHART_CHG_DATAS, name);
      this.flagChange($GF.CONSTANTS.FLOWCHART_APL_OPTIONS, name);
      if (!flowchart.isVisible()) {
        this.flagChange($GF.CONSTANTS.FLOWCHART_CHG_HIDDENCHANGE, name);
      }
    }
    trc.after();
    return this;
  }

  setCurrentOptions(): this {
    const name = this.getCurrentFlowchartName();
    this.setOptions(name);
    return this;
  }

  /**
   * (re)draw graph
   *
   * @returns {this}
   * @memberof FlowchartHandler
   */
  draw(name?: string): this {
    const trc = $GF.trace.before(this.constructor.name + '.' + 'draw()');
    if (name === undefined) {
      this.flowcharts.forEach(flowchart => {
        const name = flowchart.getName();
        this.draw(name);
      });
    } else {
      const flowchart = this.getFlowchart(name);
      flowchart.redraw();
    }
    trc.after();
    return this;
  }

  drawCurrent(): this {
    const name = this.getCurrentFlowchartName();
    this.draw(name);
    return this;
  }

  /**
   * (re)load graph,
   *
   * @returns {this}
   * @memberof FlowchartHandler
   */
  load(name?: string): this {
    const trc = $GF.trace.before(this.constructor.name + '.' + 'draw()');
    if (name === undefined) {
      this.flowcharts.forEach(flowchart => {
        this.load(name);
      });
    } else {
      const flowchart = this.getFlowchart(name);
      if (!flowchart.isVisible()) {
        this.flagChange($GF.CONSTANTS.FLOWCHART_CHG_HIDDENCHANGE, name);
      }
      flowchart.reload();
      this.aknowledgeFlagChange($GF.CONSTANTS.FLOWCHART_CHG_SOURCES, name);
    }
    trc.after();
    return this;
  }

  /**
   * load current flowchart
   *
   * @returns {this}
   * @memberof FlowchartHandler
   */
  loadCurrent(): this {
    const name = this.getCurrentFlowchartName();
    this.load(name);
    return this;
  }

  /**
   * Active option link/map
   *
   * @param {Object} objToMap
   * @memberof FlowchartHandler
   */
  setMap(objToMap: GFMap, prop: gf.TPropertieKey = 'id'): this {
    const flowchart = this.getFlowchart(this.currentFlowchartName);
    this.onMapping.active = true;
    this.onMapping.object = objToMap;
    this.onMapping.value = objToMap.getId();
    this.onMapping.$scope = this.$scope;
    this.onMapping.prop = prop;
    flowchart.setMap(this.onMapping);
    return this;
  }

  /**
   * Desactivate option
   *
   * @memberof FlowchartHandler
   */
  unsetMap(): this {
    const flowchart = this.getFlowchart(this.currentFlowchartName);
    this.onMapping.active = false;
    this.onMapping.object = undefined;
    this.onMapping.value = '';
    flowchart.unsetMap();
    return this;
  }

  /**
   * Return true if mapping object is active
   *
   * @param {properties} objToMap
   * @returns true - true if mapping mode
   * @memberof FlowchartHandler
   */
  isMapping(objToMap: GFMap): boolean {
    if (objToMap === undefined || objToMap == null) {
      return this.onMapping.active;
    }
    if (this.onMapping.active === true && objToMap === this.onMapping.object) {
      return true;
    }
    return false;
  }

  /**
   * Wait for draw.io answer
   *
   * @private
   * @param {MessageEvent} event
   * @memberof FlowchartHandler
   */
  listenMessage(event: any) {
    if (event.data !== undefined && event.data.length > 0 && event.data.substring(0, 3) === 'fc-') {
      const id = event.data.substring(3);
      const fc = this.getFlowchartById(id);
      this.currentFlowchart = fc;
      // send xml
      // if (event.source) {
      //   if (!(event.source instanceof MessagePort) && !(event.source instanceof ServiceWorker)) {
      if (fc !== undefined) {
        $GF.message.setMessage('Sending current data to draw.io editor', 'info');
        event.source.postMessage(fc.data.xml, event.origin);
        this.postedId = fc.id;
      }
      //   }
      // }
    } else {
      if (
        this.onEdit &&
        event.data !== undefined &&
        event.data.length > 0 &&
        event.data.substring(0, 3) !== 'fc-' &&
        this.currentFlowchart !== undefined
      ) {
        if (this.postedId !== undefined) {
          const fc = this.getFlowchartById(this.postedId);
          if (fc !== undefined) {
            $GF.message.setMessage('Received data from draw.io editor, refresh in progress', 'info');
            fc.redraw(event.data);
            this.onSourceChange(fc.getName());
            this.$scope.$apply();
            this.render();
          }
        }
      }
      if ((this.onEdit && event.data !== undefined) || event.data.length === 0) {
        if (this.editorWindow) {
          this.editorWindow.close();
        }
        this.onEdit = false;
        this.postedId = undefined;
        window.removeEventListener('message', this.listenMessage.bind(this), false);
        $GF.message.setMessage('Draw.io editor closed', 'info');
      }
    }
  }

  /**
   * Open graph in draw.io
   *
   * @memberof FlowchartHandler
   */
  openDrawEditor(name?: string) {
    const fc = this.getFlowchart(name);
    const urlEditor = fc.getUrlEditor();
    const theme = this.getFlowchart(name).getThemeEditor();
    const urlParams = `${urlEditor}?embed=1&spin=1&libraries=1&ui=${theme}&ready=fc-${fc.id}&src=grafana`;
    this.editorWindow = window.open(urlParams, 'MxGraph Editor', 'width=1280, height=720');
    this.onEdit = true;
    $GF.message.setMessage(`Opening current flowchart on draw.io editor`, 'info');
    window.addEventListener('message', this.listenMessage.bind(this), false);
  }

  /**
   * Get flowchart names
   *
   * @returns {string[]}
   * @memberof FlowchartHandler
   */
  getFlowchartNames(): string[] {
    return this.flowcharts.map(f => f.data.name);
  }
}
