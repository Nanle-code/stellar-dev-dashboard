import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import CounterpartyAnnotation from './CounterpartyAnnotation';

describe('CounterpartyAnnotation', () => {
  it('renders primary flow correctly', async () => {
    const onSave = jest.fn().mockResolvedValue({});
    render(<CounterpartyAnnotation address="GBXYZ" onSave={onSave} />);
    
    fireEvent.click(screen.getByTestId('edit-btn'));
    fireEvent.change(screen.getByTestId('input-nickname'), { target: { value: 'Exchange' } });
    fireEvent.change(screen.getByTestId('select-risk'), { target: { value: 'high' } });
    fireEvent.click(screen.getByTestId('save-btn'));
    
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({ nickname: 'Exchange', risk: 'high' });
    });
  });

  it('handles validation boundary case (too long)', async () => {
    render(<CounterpartyAnnotation address="GBXYZ" onSave={jest.fn()} />);
    fireEvent.click(screen.getByTestId('edit-btn'));
    fireEvent.change(screen.getByTestId('input-nickname'), { target: { value: 'A'.repeat(51) } });
    fireEvent.click(screen.getByTestId('save-btn'));
    
    expect(screen.getByTestId('annotation-error')).toHaveTextContent('too long');
  });

  it('handles save failure case', async () => {
    const onSave = jest.fn().mockRejectedValue(new Error('API error'));
    render(<CounterpartyAnnotation address="GBXYZ" onSave={onSave} />);
    
    fireEvent.click(screen.getByTestId('edit-btn'));
    fireEvent.click(screen.getByTestId('save-btn'));
    
    await waitFor(() => {
      expect(screen.getByTestId('annotation-error')).toHaveTextContent('API error');
    });
  });
});
