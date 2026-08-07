import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EmployeeWorkspaceComponent } from './employee-workspace.component';

describe('EmployeeWorkspaceComponent - Document Upload', () => {
  let component: EmployeeWorkspaceComponent;

  // Mock dependencies
  let mockRealtimeService: any;
  let mockApiService: any;
  let mockDashboardCache: any;
  let mockAiBriefService: any;
  let mockAiSuggestionService: any;
  let mockEmployeeLeadsVm: any;
  let mockInvoicesRepository: any;
  let mockQuotationsRepository: any;

  beforeEach(() => {
    mockRealtimeService = {};
    mockApiService = {};
    mockDashboardCache = {};
    mockAiBriefService = {};
    mockAiSuggestionService = {};
    mockEmployeeLeadsVm = {
      state$: { subscribe: vi.fn() } // Mock state$ observable if needed
    };
    mockInvoicesRepository = {};
    mockQuotationsRepository = {};

    // Instantiate component directly for isolated testing
    component = new EmployeeWorkspaceComponent(
      mockRealtimeService,
      mockApiService,
      mockDashboardCache,
      mockAiBriefService,
      mockAiSuggestionService,
      mockEmployeeLeadsVm,
      mockInvoicesRepository,
      mockQuotationsRepository
    );

    // Mock URL.createObjectURL and URL.revokeObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:test-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('onCompanyDocumentUpload', () => {
    it('should add selected files to companyFullDocuments', async () => {
      // Arrange
      const mockFile1 = new File(['dummy content 1'], 'test1.pdf', { type: 'application/pdf' });
      const mockFile2 = new File(['dummy content 2'], 'test2.png', { type: 'image/png' });
      
      const mockEvent = {
        target: {
          files: [mockFile1, mockFile2],
          value: 'C:\\fakepath\\some-file.pdf'
        }
      } as unknown as Event;

      // Act
      await component.onCompanyDocumentUpload(mockEvent);

      // Assert
      expect(component.companyFullDocuments.length).toBe(2);
      
      // Since it unshifts, the last file is at index 0
      expect(component.companyFullDocuments[0].name).toBe('test2.png');
      expect(component.companyFullDocuments[0].url).toBe('blob:test-url');
      expect(component.companyFullDocuments[0].size).toBe(mockFile2.size);
      
      expect(component.companyFullDocuments[1].name).toBe('test1.pdf');
      expect(component.companyFullDocuments[1].url).toBe('blob:test-url');
      expect(component.companyFullDocuments[1].size).toBe(mockFile1.size);

      // Verify the input is cleared
      expect((mockEvent.target as any).value).toBe('');
      
      // Verify URL.createObjectURL was called twice
      expect(global.URL.createObjectURL).toHaveBeenCalledTimes(2);
    });

    it('should do nothing if no files are selected', async () => {
      // Arrange
      const mockEvent = {
        target: {
          files: null,
          value: ''
        }
      } as unknown as Event;

      // Act
      await component.onCompanyDocumentUpload(mockEvent);

      // Assert
      expect(component.companyFullDocuments.length).toBe(0);
      expect(global.URL.createObjectURL).not.toHaveBeenCalled();
    });
  });

  describe('removeCompanyDocument', () => {
    it('should remove a document by ID and revoke its ObjectURL', () => {
      // Arrange
      component.companyFullDocuments = [
        { id: '1', name: 'doc1.pdf', url: 'blob:1', size: 100, uploadedAt: '2023-01-01T00:00:00.000Z' },
        { id: '2', name: 'doc2.pdf', url: 'blob:2', size: 200, uploadedAt: '2023-01-01T00:00:00.000Z' }
      ];

      // Act
      component.removeCompanyDocument('1');

      // Assert
      expect(component.companyFullDocuments.length).toBe(1);
      expect(component.companyFullDocuments[0].id).toBe('2');
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:1');
    });

    it('should do nothing if document ID does not exist', () => {
      // Arrange
      component.companyFullDocuments = [
        { id: '1', name: 'doc1.pdf', url: 'blob:1', size: 100, uploadedAt: '2023-01-01T00:00:00.000Z' }
      ];

      // Act
      component.removeCompanyDocument('non-existent-id');

      // Assert
      expect(component.companyFullDocuments.length).toBe(1);
      expect(global.URL.revokeObjectURL).not.toHaveBeenCalled();
    });
  });

  describe('emailCurrentDocument', () => {
    it('should alert if no invoice items are present', async () => {
      // Arrange
      component.invoiceItems = [];
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      
      // Act
      await component.emailCurrentDocument();

      // Assert
      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Please add at least one product'));
    });
  });
});
