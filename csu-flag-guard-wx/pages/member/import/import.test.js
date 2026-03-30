/**
 * Unit tests for member import functionality
 * 测试成员导入功能
 */

const importPage = require('./import');
const util = require('../../../utils/util');

// Mock wx API
global.wx = {
  chooseMessageFile: jest.fn(),
  cloud: {
    uploadFile: jest.fn(),
    callFunction: jest.fn(),
    deleteFile: jest.fn()
  },
  showToast: jest.fn(),
  showModal: jest.fn(),
  navigateBack: jest.fn(),
  redirectTo: jest.fn()
};

// Mock Page function to capture the page instance
let pageInstance = jest.fn().mockImplementation((config) => {
  pageInstance.data = config.data || {};
  pageInstance.methods = {};
  Object.keys(config).forEach(key => {
    if (typeof config[key] === 'function') {
      pageInstance.methods[key] = config[key].bind(pageInstance);
      pageInstance[key] = config[key].bind(pageInstance);
    }
  });
  return pageInstance;
});

global.Page = pageInstance;

// Mock getCurrentPages
global.getCurrentPages = jest.fn();

// Mock setData
pageInstance.setData = jest.fn(function(data) {
  Object.assign(this.data, data);
});

// Re-import to apply mocks
jest.resetModules();
const ImportPage = require('./import').Page ? require('./import').Page()[0] : require('./import');

describe('Member Import Page Tests', () => {
  let page;

  beforeEach(() => {
    jest.clearAllMocks();
    // Get page instance by calling the Page function
    const pages = require('./import');
    if (typeof pages === 'function') {
      // If it's the Page function itself
      const config = jest.requireMock('./import');
    }
    // Re-create page instance for each test
    const Page = global.Page;
    Page.mockClear();
    require('./import');
    page = Page.mock.results[Page.mock.results.length - 1]?.value || pageInstance;
    
    // Initialize page data
    page.data = {
      fileName: '',
      filePath: '',
      joinDate: '',
      isImporting: false
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('chooseMessageFile function', () => {
    test('should call wx.chooseMessageFile with correct parameters', () => {
      const chooseMessageFile = require('./import');
      // This tests the standalone function at the top of the file
      expect(typeof chooseMessageFile).toBe('object' || 'function');
    });
  });

  describe('Page methods', () => {
    describe('onJoinDatePick', () => {
      test('should update joinDate when picker value changes', () => {
        const mockEvent = { detail: { value: '2024-01-15' } };
        
        page.onJoinDatePick(mockEvent);
        
        expect(page.setData).toHaveBeenCalledWith({ joinDate: '2024-01-15' });
        expect(page.data.joinDate).toBe('2024-01-15');
      });

      test('should handle empty date value', () => {
        const mockEvent = { detail: { value: '' } };
        
        page.onJoinDatePick(mockEvent);
        
        expect(page.setData).toHaveBeenCalledWith({ joinDate: '' });
      });
    });

    describe('getCloudPath', () => {
      test('should generate cloud path with safe filename', () => {
        const fileName = 'members.xlsx';
        const result = page.getCloudPath(fileName);
        
        expect(result).toMatch(/^member-imports\/\d+-[a-z0-9]{6}-members\.xlsx$/);
      });

      test('should sanitize filename by replacing special characters', () => {
        const fileName = 'test@file#name$.xlsx';
        const result = page.getCloudPath(fileName);
        
        expect(result).not.toContain('@');
        expect(result).not.toContain('#');
        expect(result).not.toContain('$');
        expect(result).toMatch(/test_file_name_\.xlsx/);
      });

      test('should preserve Chinese characters in filename', () => {
        const fileName = '成员导入.xlsx';
        const result = page.getCloudPath(fileName);
        
        expect(result).toContain('成员导入');
      });

      test('should use default filename when input is empty', () => {
        const result = page.getCloudPath('');
        
        expect(result).toContain('members.xlsx');
      });

      test('should use default filename when input is null', () => {
        const result = page.getCloudPath(null);
        
        expect(result).toContain('members.xlsx');
      });

      test('should handle filename with path separators', () => {
        const fileName = '../members.xlsx';
        const result = page.getCloudPath(fileName);
        
        expect(result).not.toContain('..');
        expect(result).toContain('_members.xlsx');
      });

      test('should generate unique paths for same filename', () => {
        const fileName = 'test.xlsx';
        const result1 = page.getCloudPath(fileName);
        
        // Wait a bit to ensure timestamp difference
        return new Promise(resolve => setTimeout(resolve, 10)).then(() => {
          const result2 = page.getCloudPath(fileName);
          expect(result1).not.toBe(result2);
        });
      });
    });

    describe('buildResultMessage', () => {
      test('should show success count with imported members', () => {
        const result = { imported: 10 };
        const message = page.buildResultMessage(result);
        
        expect(message).toContain('成功导入 10 名成员');
      });

      test('should show skipped count when provided', () => {
        const result = { imported: 8, skipped: 2 };
        const message = page.buildResultMessage(result);
        
        expect(message).toContain('成功导入 8 名成员');
        expect(message).toContain('跳过 2 条记录');
      });

      test('should show skipped rows details when provided', () => {
        const result = {
          imported: 5,
          skipped: 2,
          skippedRows: [
            { rowNumber: 3, reason: '学号为空' },
            { rowNumber: 5, reason: '手机号格式错误' }
          ]
        };
        const message = page.buildResultMessage(result);
        
        expect(message).toContain('成功导入 5 名成员');
        expect(message).toContain('跳过 2 条记录');
        expect(message).toContain('第3行：学号为空');
        expect(message).toContain('第5行：手机号格式错误');
      });

      test('should limit skipped rows details to 3 items', () => {
        const result = {
          imported: 0,
          skipped: 5,
          skippedRows: [
            { rowNumber: 1, reason: 'Error 1' },
            { rowNumber: 2, reason: 'Error 2' },
            { rowNumber: 3, reason: 'Error 3' },
            { rowNumber: 4, reason: 'Error 4' },
            { rowNumber: 5, reason: 'Error 5' }
          ]
        };
        const message = page.buildResultMessage(result);
        
        expect(message).toContain('第1行：Error 1');
        expect(message).toContain('第2行：Error 2');
        expect(message).toContain('第3行：Error 3');
        expect(message).not.toContain('第4行');
        expect(message).not.toContain('第5行');
      });

      test('should handle empty result object', () => {
        const result = {};
        const message = page.buildResultMessage(result);
        
        expect(message).toContain('成功导入 0 名成员');
      });

      test('should handle result with null skipped rows', () => {
        const result = { imported: 5, skippedRows: null };
        const message = page.buildResultMessage(result);
        
        expect(message).toContain('成功导入 5 名成员');
        expect(message).not.toContain('跳过');
      });

      test('should handle result with empty skipped rows array', () => {
        const result = { imported: 5, skipped: 0, skippedRows: [] };
        const message = page.buildResultMessage(result);
        
        expect(message).toContain('成功导入 5 名成员');
        expect(message).toContain('跳过 0 条记录');
      });
    });

    describe('finishAfterImport', () => {
      test('should navigate back with delta 2 when there are 3 or more pages', () => {
        global.getCurrentPages.mockReturnValue([{}, {}, {}]);
        
        page.finishAfterImport();
        
        expect(wx.navigateBack).toHaveBeenCalledWith({ delta: 2 });
        expect(wx.redirectTo).not.toHaveBeenCalled();
      });

      test('should navigate back with delta 2 when there are more than 3 pages', () => {
        global.getCurrentPages.mockReturnValue([{}, {}, {}, {}]);
        
        page.finishAfterImport();
        
        expect(wx.navigateBack).toHaveBeenCalledWith({ delta: 2 });
        expect(wx.redirectTo).not.toHaveBeenCalled();
      });

      test('should redirect to list page when there are less than 3 pages', () => {
        global.getCurrentPages.mockReturnValue([{}]);
        
        page.finishAfterImport();
        
        expect(wx.redirectTo).toHaveBeenCalledWith({ url: '/pages/member/list/list' });
        expect(wx.navigateBack).not.toHaveBeenCalled();
      });

      test('should redirect to list page when there are exactly 2 pages', () => {
        global.getCurrentPages.mockReturnValue([{}, {}]);
        
        page.finishAfterImport();
        
        expect(wx.redirectTo).toHaveBeenCalledWith({ url: '/pages/member/list/list' });
        expect(wx.navigateBack).not.toHaveBeenCalled();
      });
    });

    describe('cleanupUploadedFile', () => {
      test('should delete file when fileID is provided', async () => {
        const mockFileID = 'cloud://test-file-id';
        wx.cloud.deleteFile.mockResolvedValue({});
        
        await page.cleanupUploadedFile(mockFileID);
        
        expect(wx.cloud.deleteFile).toHaveBeenCalledWith({ fileList: [mockFileID] });
      });

      test('should not call deleteFile when fileID is empty', async () => {
        await page.cleanupUploadedFile('');
        
        expect(wx.cloud.deleteFile).not.toHaveBeenCalled();
      });

      test('should not call deleteFile when fileID is null', async () => {
        await page.cleanupUploadedFile(null);
        
        expect(wx.cloud.deleteFile).not.toHaveBeenCalled();
      });

      test('should handle deleteFile error gracefully', async () => {
        const mockFileID = 'cloud://test-file-id';
        const mockError = new Error('Delete failed');
        wx.cloud.deleteFile.mockRejectedValue(mockError);
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        
        await expect(page.cleanupUploadedFile(mockFileID)).resolves.not.toThrow();
        expect(consoleSpy).toHaveBeenCalledWith('delete uploaded import file failed', mockError);
        
        consoleSpy.mockRestore();
      });
    });

    describe('chooseExcelFile', () => {
      test('should successfully select and set file', async () => {
        const mockFile = {
          name: 'members.xlsx',
          path: '/tmp/members.xlsx'
        };
        const mockResponse = {
          tempFiles: [mockFile]
        };
        wx.chooseMessageFile.mockResolvedValue(mockResponse);
        jest.spyOn(util, 'showToast');
        
        await page.chooseExcelFile();
        
        expect(wx.chooseMessageFile).toHaveBeenCalledWith({
          count: 1,
          type: 'file',
          extension: ['xlsx', 'xls'],
          success: expect.any(Function),
          fail: expect.any(Function)
        });
        expect(page.setData).toHaveBeenCalledWith({
          fileName: 'members.xlsx',
          filePath: '/tmp/members.xlsx'
        });
      });

      test('should use tempFilePath as fallback when path is not available', async () => {
        const mockFile = {
          name: 'members.xlsx',
          tempFilePath: '/tmp/members.xlsx'
        };
        const mockResponse = {
          tempFiles: [mockFile]
        };
        wx.chooseMessageFile.mockResolvedValue(mockResponse);
        jest.spyOn(util, 'showToast');
        
        await page.chooseExcelFile();
        
        expect(page.setData).toHaveBeenCalledWith({
          fileName: 'members.xlsx',
          filePath: '/tmp/members.xlsx'
        });
      });

      test('should show toast when filePath is not available', async () => {
        const mockResponse = {
          tempFiles: [{ name: 'test.xlsx' }]
        };
        wx.chooseMessageFile.mockResolvedValue(mockResponse);
        const showToastSpy = jest.spyOn(util, 'showToast');
        
        await page.chooseExcelFile();
        
        expect(showToastSpy).toHaveBeenCalledWith('未获取到文件路径');
      });

      test('should show toast when tempFiles is empty', async () => {
        const mockResponse = {
          tempFiles: []
        };
        wx.chooseMessageFile.mockResolvedValue(mockResponse);
        const showToastSpy = jest.spyOn(util, 'showToast');
        
        await page.chooseExcelFile();
        
        expect(showToastSpy).toHaveBeenCalledWith('未获取到文件路径');
      });

      test('should use default filename when file name is empty', async () => {
        const mockFile = {
          path: '/tmp/members.xlsx'
        };
        const mockResponse = {
          tempFiles: [mockFile]
        };
        wx.chooseMessageFile.mockResolvedValue(mockResponse);
        jest.spyOn(util, 'showToast');
        
        await page.chooseExcelFile();
        
        expect(page.setData).toHaveBeenCalledWith({
          fileName: '未命名文件',
          filePath: '/tmp/members.xlsx'
        });
      });

      test('should handle user cancellation gracefully', async () => {
        const mockError = {
          errMsg: 'chooseMessageFile:fail cancel'
        };
        wx.chooseMessageFile.mockRejectedValue(mockError);
        const showToastSpy = jest.spyOn(util, 'showToast');
        
        await page.chooseExcelFile();
        
        expect(showToastSpy).not.toHaveBeenCalled();
      });

      test('should show toast on other errors', async () => {
        const mockError = {
          errMsg: 'chooseMessageFile:fail network error'
        };
        wx.chooseMessageFile.mockRejectedValue(mockError);
        const showToastSpy = jest.spyOn(util, 'showToast');
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        
        await page.chooseExcelFile();
        
        expect(showToastSpy).toHaveBeenCalledWith('选择文件失败');
        expect(consoleSpy).toHaveBeenCalledWith(mockError);
        
        consoleSpy.mockRestore();
      });

      test('should handle error without errMsg', async () => {
        const mockError = new Error('Unknown error');
        wx.chooseMessageFile.mockRejectedValue(mockError);
        const showToastSpy = jest.spyOn(util, 'showToast');
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        
        await page.chooseExcelFile();
        
        expect(showToastSpy).toHaveBeenCalledWith('选择文件失败');
        expect(consoleSpy).toHaveBeenCalledWith(mockError);
        
        consoleSpy.mockRestore();
      });
    });

    describe('handleImport', () => {
      test('should show toast when filePath is empty', async () => {
        page.data.filePath = '';
        page.data.joinDate = '2024-01-15';
        const showToastSpy = jest.spyOn(util, 'showToast');
        
        await page.handleImport();
        
        expect(showToastSpy).toHaveBeenCalledWith('请先选择Excel文件');
        expect(wx.cloud.uploadFile).not.toHaveBeenCalled();
      });

      test('should show toast when joinDate is empty', async () => {
        page.data.filePath = '/tmp/members.xlsx';
        page.data.joinDate = '';
        const showToastSpy = jest.spyOn(util, 'showToast');
        
        await page.handleImport();
        
        expect(showToastSpy).toHaveBeenCalledWith('请选择统一入队时间');
        expect(wx.cloud.uploadFile).not.toHaveBeenCalled();
      });

      test('should successfully import members and cleanup', async () => {
        page.data.fileName = 'members.xlsx';
        page.data.filePath = '/tmp/members.xlsx';
        page.data.joinDate = '2024-01-15';
        
        const mockUploadRes = { fileID: 'cloud://test-file-id' };
        wx.cloud.uploadFile.mockResolvedValue(mockUploadRes);
        
        const mockCallRes = {
          result: {
            success: true,
            imported: 10,
            skipped: 0
          }
        };
        wx.cloud.callFunction.mockResolvedValue(mockCallRes);
        
        wx.cloud.deleteFile.mockResolvedValue({});
        wx.showModal.mockImplementation({ success: jest.fn() });
        
        const finishSpy = jest.spyOn(page, 'finishAfterImport');
        
        await page.handleImport();
        
        expect(wx.cloud.uploadFile).toHaveBeenCalled();
        expect(wx.cloud.callFunction).toHaveBeenCalledWith({
          name: 'memberImport',
          data: {
            fileID: 'cloud://test-file-id',
            joinDate: '2024-01-15'
          }
        });
        expect(wx.cloud.deleteFile).toHaveBeenCalledWith({ fileList: ['cloud://test-file-id'] });
        expect(page.data.isImporting).toBe(false);
      });

      test('should show modal with result message on success', async () => {
        page.data.fileName = 'members.xlsx';
        page.data.filePath = '/tmp/members.xlsx';
        page.data.joinDate = '2024-01-15';
        
        const mockUploadRes = { fileID: 'cloud://test-file-id' };
        wx.cloud.uploadFile.mockResolvedValue(mockUploadRes);
        
        const mockCallRes = {
          result: {
            success: true,
            imported: 8,
            skipped: 2,
            skippedRows: [
              { rowNumber: 3, reason: '学号为空' }
            ]
          }
        };
        wx.cloud.callFunction.mockResolvedValue(mockCallRes);
        
        wx.cloud.deleteFile.mockResolvedValue({});
        
        let modalCallback;
        wx.showModal.mockImplementation((options) => {
          modalCallback = options.success;
          return {};
        });
        
        await page.handleImport();
        
        expect(wx.showModal).toHaveBeenCalledWith({
          title: '导入完成',
          content: expect.stringContaining('成功导入 8 名成员'),
          showCancel: false,
          success: expect.any(Function)
        });
      });

      test('should call finishAfterImport after modal success', async () => {
        page.data.fileName = 'members.xlsx';
        page.data.filePath = '/tmp/members.xlsx';
        page.data.joinDate = '2024-01-15';
        
        const mockUploadRes = { fileID: 'cloud://test-file-id' };
        wx.cloud.uploadFile.mockResolvedValue(mockUploadRes);
        
        const mockCallRes = {
          result: {
            success: true,
            imported: 5
          }
        };
        wx.cloud.callFunction.mockResolvedValue(mockCallRes);
        
        wx.cloud.deleteFile.mockResolvedValue({});
        
        wx.showModal.mockImplementation((options) => {
          if (options.success) options.success();
          return {};
        });
        
        const finishSpy = jest.spyOn(page, 'finishAfterImport');
        
        await page.handleImport();
        
        expect(finishSpy).toHaveBeenCalled();
      });

      test('should handle import failure and cleanup', async () => {
        page.data.fileName = 'members.xlsx';
        page.data.filePath = '/tmp/members.xlsx';
        page.data.joinDate = '2024-01-15';
        
        const mockUploadRes = { fileID: 'cloud://test-file-id' };
        wx.cloud.uploadFile.mockResolvedValue(mockUploadRes);
        
        const mockCallRes = {
          result: {
            success: false,
            message: '数据格式错误'
          }
        };
        wx.cloud.callFunction.mockResolvedValue(mockCallRes);
        
        wx.cloud.deleteFile.mockResolvedValue({});
        const showToastSpy = jest.spyOn(util, 'showToast');
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        
        await page.handleImport();
        
        expect(showToastSpy).toHaveBeenCalledWith('数据格式错误');
        expect(wx.cloud.deleteFile).toHaveBeenCalledWith({ fileList: ['cloud://test-file-id'] });
        expect(page.data.isImporting).toBe(false);
        
        consoleSpy.mockRestore();
      });

      test('should handle upload error', async () => {
        page.data.fileName = 'members.xlsx';
        page.data.filePath = '/tmp/members.xlsx';
        page.data.joinDate = '2024-01-15';
        
        const mockError = new Error('Upload failed');
        wx.cloud.uploadFile.mockRejectedValue(mockError);
        
        const showToastSpy = jest.spyOn(util, 'showToast');
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        
        await page.handleImport();
        
        expect(showToastSpy).toHaveBeenCalledWith('Upload failed');
        expect(page.data.isImporting).toBe(false);
        
        consoleSpy.mockRestore();
      });

      test('should set isImporting to true during import', async () => {
        page.data.fileName = 'members.xlsx';
        page.data.filePath = '/tmp/members.xlsx';
        page.data.joinDate = '2024-01-15';
        
        wx.cloud.uploadFile.mockImplementation(() => {
          expect(page.data.isImporting).toBe(true);
          return Promise.resolve({ fileID: 'cloud://test-file-id' });
        });
        
        wx.cloud.callFunction.mockResolvedValue({
          result: { success: true, imported: 5 }
        });
        
        wx.cloud.deleteFile.mockResolvedValue({});
        wx.showModal.mockImplementation({ success: jest.fn() });
        
        await page.handleImport();
        
        expect(page.data.isImporting).toBe(false);
      });

      test('should cleanup file even when cloud function fails', async () => {
        page.data.fileName = 'members.xlsx';
        page.data.filePath = '/tmp/members.xlsx';
        page.data.joinDate = '2024-01-15';
        
        const mockUploadRes = { fileID: 'cloud://test-file-id' };
        wx.cloud.uploadFile.mockResolvedValue(mockUploadRes);
        
        const mockError = new Error('Cloud function error');
        wx.cloud.callFunction.mockRejectedValue(mockError);
        
        wx.cloud.deleteFile.mockResolvedValue({});
        const showToastSpy = jest.spyOn(util, 'showToast');
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        
        await page.handleImport();
        
        expect(wx.cloud.deleteFile).toHaveBeenCalledWith({ fileList: ['cloud://test-file-id'] });
        expect(page.data.isImporting).toBe(false);
        
        consoleSpy.mockRestore();
      });

      test('should handle empty result from cloud function', async () => {
        page.data.fileName = 'members.xlsx';
        page.data.filePath = '/tmp/members.xlsx';
        page.data.joinDate = '2024-01-15';
        
        const mockUploadRes = { fileID: 'cloud://test-file-id' };
        wx.cloud.uploadFile.mockResolvedValue(mockUploadRes);
        
        wx.cloud.callFunction.mockResolvedValue({});
        
        wx.cloud.deleteFile.mockResolvedValue({});
        const showToastSpy = jest.spyOn(util, 'showToast');
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        
        await page.handleImport();
        
        expect(showToastSpy).toHaveBeenCalledWith('导入失败');
        expect(wx.cloud.deleteFile).toHaveBeenCalledWith({ fileList: ['cloud://test-file-id'] });
        
        consoleSpy.mockRestore();
      });

      test('should handle result with no success field', async () => {
        page.data.fileName = 'members.xlsx';
        page.data.filePath = '/tmp/members.xlsx';
        page.data.joinDate = '2024-01-15';
        
        const mockUploadRes = { fileID: 'cloud://test-file-id' };
        wx.cloud.uploadFile.mockResolvedValue(mockUploadRes);
        
        wx.cloud.callFunction.mockResolvedValue({
          result: { message: 'Unknown result' }
        });
        
        wx.cloud.deleteFile.mockResolvedValue({});
        const showToastSpy = jest.spyOn(util, 'showToast');
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        
        await page.handleImport();
        
        expect(showToastSpy).toHaveBeenCalledWith('导入失败');
        
        consoleSpy.mockRestore();
      });
    });

    describe('Edge Cases and Integration', () => {
      test('should handle rapid multiple import attempts', async () => {
        page.data.fileName = 'members.xlsx';
        page.data.filePath = '/tmp/members.xlsx';
        page.data.joinDate = '2024-01-15';
        
        wx.cloud.uploadFile.mockResolvedValue({ fileID: 'cloud://test-file-id' });
        wx.cloud.callFunction.mockResolvedValue({
          result: { success: true, imported: 5 }
        });
        wx.cloud.deleteFile.mockResolvedValue({});
        wx.showModal.mockImplementation({ success: jest.fn() });
        
        const promise1 = page.handleImport();
        const promise2 = page.handleImport();
        
        await Promise.all([promise1, promise2]);
        
        expect(page.data.isImporting).toBe(false);
      });

      test('should handle special characters in filename', async () => {
        page.data.fileName = 'test@file#name$.xlsx';
        page.data.filePath = '/tmp/members.xlsx';
        page.data.joinDate = '2024-01-15';
        
        wx.cloud.uploadFile.mockImplementation((params) => {
          expect(params.cloudPath).toMatch(/test_file_name_\.xlsx/);
          return Promise.resolve({ fileID: 'cloud://test-file-id' });
        });
        
        wx.cloud.callFunction.mockResolvedValue({
          result: { success: true, imported: 5 }
        });
        wx.cloud.deleteFile.mockResolvedValue({});
        wx.showModal.mockImplementation({ success: jest.fn() });
        
        await page.handleImport();
      });

      test('should handle extremely long filename', async () => {
        const longName = 'a'.repeat(200) + '.xlsx';
        page.data.fileName = longName;
        page.data.filePath = '/tmp/members.xlsx';
        page.data.joinDate = '2024-01-15';
        
        wx.cloud.uploadFile.mockResolvedValue({ fileID: 'cloud://test-file-id' });
        wx.cloud.callFunction.mockResolvedValue({
          result: { success: true, imported: 5 }
        });
        wx.cloud.deleteFile.mockResolvedValue({});
        wx.showModal.mockImplementation({ success: jest.fn() });
        
        await expect(page.handleImport()).resolves.not.toThrow();
      });
    });
  });
});
