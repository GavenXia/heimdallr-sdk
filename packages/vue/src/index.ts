import { formatDate, generateUUID } from '@heimdallr-sdk/utils';
import {
  UnknownFunc,
  BasePluginType,
  ViewModel,
  VueReportDataType,
  ReportDataType,
  EventTypes,
  BrowserBreadcrumbTypes,
  ConsoleTypes,
  BreadcrumbLevel
} from '@heimdallr-sdk/types';
import { VueTypes } from './types';

const VuePlugin: BasePluginType = {
  name: 'vuePlugin',
  monitor(notify: (data: VueReportDataType) => void) {
    const { vue: vm } = this.getOptions();
    const { debug } = this.context;
    if (!vm) {
      this.log('Missing Vue in options');
      return;
    }
    const { errorHandler, silent } = vm.config;
    vm.config.errorHandler = (error: any, vm: ViewModel, lifecycleHook: string) => {
      const { name, message, stack = '' } = error;
      notify({
        name,
        message,
        hook: lifecycleHook,
        stack,
        sub_type: VueTypes.ERROR,
        ...parseStack(stack)
      });
      if (debug) {
        if (typeof errorHandler === 'function') {
          (errorHandler as UnknownFunc).call(this.vm, error, vm, lifecycleHook);
        } else if (!silent) {
          const message = `Error in ${lifecycleHook}: "${stack && stack.toString()}"`;
          this.log(message, ConsoleTypes.ERROR);
        }
      }
    };
  },
  transform(data: VueReportDataType): ReportDataType<VueReportDataType> {
    const id = generateUUID();
    // 添加用户行为栈
    const { hook, stack } = data;
    this.breadcrumb.unshift({
      eventId: id,
      type: BrowserBreadcrumbTypes.FRAMEWORK,
      level: BreadcrumbLevel.FATAL,
      message: `Error in Vue/${hook}: "${stack && stack.toString()}"`
    });
    const breadcrumb = this.breadcrumb.getStack();
    this.breadcrumb.clear();
    return {
      id,
      time: formatDate(),
      type: EventTypes.VUE,
      breadcrumb,
      data
    };
  }
};

function parseStack(stack: string) {
  const REG_EXP = /([a-z|0-9|-]*).js:[0-9]*:[0-9]*/;
  const [, sourceFile] = stack.split('\n');
  const [matched = ''] = REG_EXP.exec(sourceFile) || [];
  const [fileName, lineCol = ''] = matched.split('.js:');
  const [line, col] = lineCol.split(':');
  const lineno = Number(line);
  const colno = Number(col);
  if (!fileName || lineno !== lineno || colno !== colno) {
    return {};
  }
  return {
    lineno,
    colno,
    filename: `${fileName}.js`
  };
}

export default VuePlugin;
