import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { apiClient } from '../lib/apiClient';
import Toast from 'react-native-toast-message';

type Bank = {
  name: string;
  code: string;
  longcode: string;
  gateway: string;
  pay_with_bank: boolean;
  active: boolean;
  country: string;
  currency: string;
  type: string;
  id: number;
  createdAt: string;
  updatedAt: string;
};

type WithdrawalCalculation = {
  coin_symbol: string;
  coin_amount: number;
  usd_amount: number;
  ngn_amount: number;
  fee_amount: number;
  final_amount: number;
  exchange_rate: number;
  is_valid: boolean;
  errors?: string[];
};

type WithdrawalLimits = {
  minUsd: number;
  minNgn: number;
  maxSingleUsd: number;
  maxDailyUsd: number;
  exchangeRate: {
    usd_to_ngn: number;
  };
  fees: {
    percentage: number;
    fixed_ngn: number;
  };
};

type CoinBalance = {
  coin_symbol: string;
  balance: number;
  value_usd: number;
  fiat_value_usd: number;
};

interface WithdrawalModalProps {
  visible: boolean;
  onClose: () => void;
  coinBalances: CoinBalance[];
  onWithdrawalSuccess: () => void;
}

export default function WithdrawalModal({
  visible,
  onClose,
  coinBalances,
  onWithdrawalSuccess,
}: WithdrawalModalProps) {
  // Step management
  const [currentStep, setCurrentStep] = useState<'currency' | 'amount' | 'bank' | 'confirm'>('currency');
  const [selectedCurrency, setSelectedCurrency] = useState<'NGN' | 'USD'>('NGN');

  // Form data
  const [coinSymbol, setCoinSymbol] = useState('');
  const [coinAmount, setCoinAmount] = useState('');
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');

  // API data
  const [banks, setBanks] = useState<Bank[]>([]);
  const [withdrawalLimits, setWithdrawalLimits] = useState<WithdrawalLimits | null>(null);
  const [withdrawalCalculation, setWithdrawalCalculation] = useState<WithdrawalCalculation | null>(null);

  // Loading states
  const [isLoadingBanks, setIsLoadingBanks] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isVerifyingAccount, setIsVerifyingAccount] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);

  // Validation
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [bankSearchQuery, setBankSearchQuery] = useState('');

  // Refs
  const calculationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize form when modal opens
  useEffect(() => {
    if (visible) {
      resetForm();
      fetchWithdrawalConfig();
      if (coinBalances.length > 0) {
        setCoinSymbol(coinBalances[0].coin_symbol);
      }
    }
  }, [visible, coinBalances]);

  const resetForm = () => {
    setCurrentStep('currency');
    setSelectedCurrency('NGN');
    setCoinSymbol('');
    setCoinAmount('');
    setSelectedBank(null);
    setAccountNumber('');
    setAccountName('');
    setBankSearchQuery('');
    setWithdrawalCalculation(null);
    setValidationErrors([]);
    // Don't reset banks array as it's expensive to reload
  };

  const fetchWithdrawalConfig = async () => {
    setIsLoadingConfig(true);
    try {
      const response = await apiClient.get<WithdrawalLimits>('/v1/withdrawals/config');
      if (response.ok && response.data) {
        setWithdrawalLimits(response.data);
      } else {
        console.error('Failed to fetch withdrawal config:', response.errors);
        Toast.show({
          type: 'error',
          text1: 'Configuration Error',
          text2: 'Unable to load withdrawal settings. Please try again.',
          visibilityTime: 3000,
        });
      }
    } catch (error) {
      console.error('Error fetching withdrawal config:', error);
      Toast.show({
        type: 'error',
        text1: 'Network Error',
        text2: 'Unable to connect to server. Please check your connection.',
        visibilityTime: 3000,
      });
    } finally {
      setIsLoadingConfig(false);
    }
  };

  const fetchBanks = async () => {
    if (banks && banks.length > 0) return; // Already loaded

    setIsLoadingBanks(true);
    try {
      const response = await apiClient.get<{banks: Bank[]}>('/v1/withdrawals/banks');
      console.log('Banks API response:', { ok: response.ok, data: response.data, type: typeof response.data });
      
      // The API returns { banks: [...] } not just the array directly
      const banksArray = response.data?.banks;
      
      if (response.ok && banksArray && Array.isArray(banksArray)) {
        console.log('Setting banks:', banksArray.length, 'banks loaded');
        setBanks(banksArray);
      } else {
        console.error('Invalid banks response:', response.data);
        setBanks([]); // Set to empty array on error
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to load banks',
          visibilityTime: 3000,
        });
      }
    } catch (error) {
      console.error('Error fetching banks:', error);
      setBanks([]); // Set to empty array on error
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load banks',
        visibilityTime: 3000,
      });
    } finally {
      setIsLoadingBanks(false);
    }
  };

  const validateWithdrawal = useCallback(() => {
    const errors: string[] = [];
    const amount = parseFloat(coinAmount);
    const selectedCoin = coinBalances.find(b => b.coin_symbol === coinSymbol);

    if (!selectedCoin) {
      errors.push('Please select a coin to withdraw.');
      return errors;
    }
    if (!selectedCoin.value_usd || selectedCoin.value_usd <= 0) {
      errors.push('Selected coin has no valid USD value set.');
      return errors;
    }
    if (isNaN(amount) || amount <= 0) {
      errors.push('Please enter a valid amount greater than 0.');
      return errors;
    }
    if (selectedCoin.balance < amount) {
      errors.push(`Insufficient balance. Available: ${selectedCoin.balance.toLocaleString()} ${coinSymbol}`);
      return errors;
    }

    if (withdrawalLimits && withdrawalLimits.exchangeRate && withdrawalLimits.fees) {
      const estimatedUsd = amount * selectedCoin.value_usd;
      if (estimatedUsd < withdrawalLimits.minUsd) {
        errors.push(`Minimum withdrawal is $${withdrawalLimits.minUsd} USD equivalent`);
        return errors;
      }
      const estimatedNgn = estimatedUsd * withdrawalLimits.exchangeRate.usd_to_ngn * (1 - withdrawalLimits.fees.percentage) - withdrawalLimits.fees.fixed_ngn;
      if (estimatedNgn < withdrawalLimits.minNgn) {
        errors.push(`Minimum final amount is approximately ₦${withdrawalLimits.minNgn.toLocaleString()} (after fees)`);
        return errors;
      }
    }
    return errors;
  }, [coinAmount, coinSymbol, coinBalances, withdrawalLimits]);

  // Debounced calculation
  useEffect(() => {
    const errors = validateWithdrawal();
    setValidationErrors(errors);

    if (errors.length === 0 && coinAmount && parseFloat(coinAmount) > 0) {
      if (calculationTimeoutRef.current) {
        clearTimeout(calculationTimeoutRef.current);
      }
      calculationTimeoutRef.current = setTimeout(() => {
        calculateWithdrawal();
      }, 800);
      return () => {
        if (calculationTimeoutRef.current) {
          clearTimeout(calculationTimeoutRef.current);
        }
      };
    } else {
      setWithdrawalCalculation(null);
      setIsCalculating(false);
    }
  }, [coinAmount, coinSymbol, coinBalances, withdrawalLimits]);

  const calculateWithdrawal = async () => {
    if (!coinAmount || !coinSymbol) return;

    setIsCalculating(true);
    try {
      const response = await apiClient.post<WithdrawalCalculation>('/v1/withdrawals/calculate', {
        coin_symbol: coinSymbol,
        coin_amount: parseFloat(coinAmount),
      });

      if (response.ok && response.data) {
        setWithdrawalCalculation(response.data);
      } else {
        setWithdrawalCalculation(null);
        Toast.show({
          type: 'error',
          text1: 'Calculation Error',
          text2: response.errors?.[0]?.detail || 'Failed to calculate withdrawal',
          visibilityTime: 3000,
        });
      }
    } catch (error) {
      console.error('Error calculating withdrawal:', error);
      setWithdrawalCalculation(null);
    } finally {
      setIsCalculating(false);
    }
  };

  const verifyBankAccount = async () => {
    if (!selectedBank || !accountNumber.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Missing Information',
        text2: 'Please select a bank and enter account number',
        visibilityTime: 3000,
      });
      return;
    }

    // Validate account number format - must be exactly 10 digits
    const cleanAccountNumber = accountNumber.trim();
    if (!/^\d{10}$/.test(cleanAccountNumber)) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Account Number',
        text2: 'Account number must be exactly 10 digits',
        visibilityTime: 3000,
      });
      return;
    }

    console.log('Verifying account:', {
      bank_code: selectedBank.code,
      account_number: cleanAccountNumber,
      bank_name: selectedBank.name
    });

    setIsVerifyingAccount(true);
    try {
      const response = await apiClient.post<{ account_name: string }>('/v1/withdrawals/verify-account', {
        bank_code: selectedBank.code,
        account_number: cleanAccountNumber,
      });

      if (response.ok && response.data) {
        setAccountName(response.data.account_name);
        Toast.show({
          type: 'success',
          text1: 'Account Verified',
          text2: `Account holder: ${response.data.account_name}`,
          visibilityTime: 3000,
        });
      } else {
        setAccountName('');
        Toast.show({
          type: 'error',
          text1: 'Verification Failed',
          text2: response.errors?.[0]?.detail || 'Unable to verify account',
          visibilityTime: 3000,
        });
      }
    } catch (error: any) {
      console.error('Error verifying account:', error);
      console.error('Error response data:', error.response?.data);
      console.error('Error status:', error.response?.status);
      
      setAccountName('');
      
      // Handle validation errors specifically
      if (error.response?.status === 422 && error.response?.data?.errors) {
        const errors = error.response.data.errors;
        const errorMessage = Array.isArray(errors) && errors.length > 0 
          ? errors[0].detail || errors[0].message || 'Validation failed'
          : 'Invalid input data';
          
        Toast.show({
          type: 'error',
          text1: 'Validation Error',
          text2: errorMessage,
          visibilityTime: 4000,
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Verification Failed',
          text2: error.response?.data?.message || 'Unable to verify account',
          visibilityTime: 3000,
        });
      }
    } finally {
      setIsVerifyingAccount(false);
    }
  };

  const processWithdrawal = async () => {
    if (!withdrawalCalculation || !selectedBank || !accountNumber || !accountName) {
      return;
    }

    Alert.alert(
      'Confirm Withdrawal',
      `You are about to withdraw ${coinAmount} ${coinSymbol} (₦${withdrawalCalculation.final_amount.toLocaleString()}) to ${accountName} at ${selectedBank.name}. This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: async () => {
            setIsProcessing(true);
            try {
              const response = await apiClient.post('/v1/withdrawals', {
                coin_symbol: coinSymbol,
                coin_amount: parseFloat(coinAmount),
                bank_code: selectedBank.code,
                account_number: accountNumber,
                account_name: accountName,
              });

              if (response.ok) {
                Toast.show({
                  type: 'success',
                  text1: 'Withdrawal Initiated',
                  text2: 'Your withdrawal is being processed',
                  visibilityTime: 4000,
                });
                onWithdrawalSuccess();
                onClose();
                resetForm();
              } else {
                Toast.show({
                  type: 'error',
                  text1: 'Withdrawal Failed',
                  text2: response.errors?.[0]?.detail || 'Failed to process withdrawal',
                  visibilityTime: 4000,
                });
              }
            } catch (error) {
              console.error('Error processing withdrawal:', error);
              Toast.show({
                type: 'error',
                text1: 'Withdrawal Failed',
                text2: 'Failed to process withdrawal',
                visibilityTime: 4000,
              });
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ]
    );
  };

  const filteredBanks = Array.isArray(banks) 
    ? banks.filter(bank => 
        bank && bank.name && bank.name.toLowerCase().includes(bankSearchQuery.toLowerCase())
      )
    : [];

  const canProceedFromAmount = () => {
    return validationErrors.length === 0 && withdrawalCalculation && !isCalculating && !isLoadingConfig && withdrawalLimits;
  };

  const canProceedFromBank = () => {
    return selectedBank && accountNumber.length >= 10 && accountName;
  };

  const renderCurrencyStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Select Currency</Text>
      <Text style={styles.stepSubtitle}>Choose your withdrawal currency</Text>

      <TouchableOpacity
        style={[styles.currencyOption, selectedCurrency === 'NGN' && styles.currencyOptionActive]}
        onPress={() => setSelectedCurrency('NGN')}
      >
        <View style={styles.currencyInfo}>
          <Text style={styles.currencySymbol}>₦</Text>
          <View>
            <Text style={[styles.currencyName, selectedCurrency === 'NGN' && styles.currencyNameActive]}>
              Nigerian Naira (NGN)
            </Text>
            <Text style={[styles.currencyDesc, selectedCurrency === 'NGN' && styles.currencyDescActive]}>
              Instant bank transfer via Paystack
            </Text>
          </View>
        </View>
        {selectedCurrency === 'NGN' && (
          <FontAwesome name="check-circle" size={24} color="#25D366" />
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.currencyOption}
        onPress={() => {
          Toast.show({
            type: 'info',
            text1: 'Coming Soon',
            text2: 'USD withdrawals will be available soon',
            visibilityTime: 3000,
          });
        }}
      >
        <View style={styles.currencyInfo}>
          <Text style={styles.currencySymbol}>$</Text>
          <View>
            <Text style={styles.currencyName}>US Dollar (USD)</Text>
            <Text style={styles.currencyDesc}>Coming soon</Text>
          </View>
        </View>
        <Text style={styles.comingSoon}>Soon</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.nextButton, selectedCurrency !== 'NGN' && styles.nextButtonDisabled]}
        onPress={() => setCurrentStep('amount')}
        disabled={selectedCurrency !== 'NGN'}
      >
        <Text style={styles.nextButtonText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );

  const renderAmountStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Withdrawal Amount</Text>
      <Text style={styles.stepSubtitle}>Enter the amount you want to withdraw</Text>

      {/* Coin Selection */}
      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Select Coin</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.coinSelector}>
          {coinBalances.map((balance) => (
            <TouchableOpacity
              key={balance.coin_symbol}
              style={[
                styles.coinOption,
                coinSymbol === balance.coin_symbol && styles.coinOptionActive,
              ]}
              onPress={() => setCoinSymbol(balance.coin_symbol)}
            >
              <Text style={[
                styles.coinOptionText,
                coinSymbol === balance.coin_symbol && styles.coinOptionTextActive,
              ]}>
                {balance.coin_symbol}
              </Text>
              <Text style={[
                styles.coinOptionBalance,
                coinSymbol === balance.coin_symbol && styles.coinOptionBalanceActive,
              ]}>
                {balance.balance.toFixed(2)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Amount Input */}
      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Amount</Text>
        <TextInput
          style={styles.formInput}
          value={coinAmount}
          onChangeText={(text) => {
            const cleaned = text.replace(/[^0-9.]/g, '');
            const parts = cleaned.split('.');
            if (parts.length > 2) return;
            if (parts[1] && parts[1].length > 8) return;
            setCoinAmount(cleaned);
          }}
          placeholder="0.00"
          placeholderTextColor="#999"
          keyboardType="decimal-pad"
        />
        {coinSymbol && (
          <Text style={styles.formHint}>
            Available: {coinBalances.find(b => b.coin_symbol === coinSymbol)?.balance.toFixed(2) || '0.00'} {coinSymbol}
          </Text>
        )}
      </View>

      {/* Loading Config */}
      {isLoadingConfig && (
        <View style={styles.calculationContainer}>
          <ActivityIndicator size="small" color="#FF6B00" />
          <Text style={styles.calculationText}>Loading withdrawal settings...</Text>
        </View>
      )}

      {/* Validation Errors */}
      {validationErrors.length > 0 && !isLoadingConfig && (
        <View style={styles.errorContainer}>
          {validationErrors.map((error, index) => (
            <Text key={index} style={styles.errorText}>• {error}</Text>
          ))}
        </View>
      )}

      {/* Config Not Available Warning */}
      {!isLoadingConfig && !withdrawalLimits && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>• Unable to load withdrawal settings. Please refresh and try again.</Text>
        </View>
      )}

      {/* Calculation Results */}
      {isCalculating && (
        <View style={styles.calculationContainer}>
          <ActivityIndicator size="small" color="#FF6B00" />
          <Text style={styles.calculationText}>Calculating...</Text>
        </View>
      )}

      {withdrawalCalculation && (
        <View style={styles.calculationContainer}>
          <Text style={styles.calculationTitle}>Withdrawal Summary</Text>
          <View style={styles.calculationRow}>
            <Text style={styles.calculationLabel}>USD Value:</Text>
            <Text style={styles.calculationValue}>${withdrawalCalculation.usd_amount.toFixed(2)}</Text>
          </View>
          <View style={styles.calculationRow}>
            <Text style={styles.calculationLabel}>NGN Amount:</Text>
            <Text style={styles.calculationValue}>₦{withdrawalCalculation.ngn_amount.toLocaleString()}</Text>
          </View>
          <View style={styles.calculationRow}>
            <Text style={styles.calculationLabel}>Fees:</Text>
            <Text style={styles.calculationValue}>₦{withdrawalCalculation.fee_amount.toLocaleString()}</Text>
          </View>
          <View style={[styles.calculationRow, styles.calculationRowFinal]}>
            <Text style={styles.calculationLabelFinal}>You'll Receive:</Text>
            <Text style={styles.calculationValueFinal}>₦{withdrawalCalculation.final_amount.toLocaleString()}</Text>
          </View>
        </View>
      )}

      <View style={styles.stepButtons}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setCurrentStep('currency')}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.nextButton, !canProceedFromAmount() && styles.nextButtonDisabled]}
          onPress={() => {
            fetchBanks();
            setCurrentStep('bank');
          }}
          disabled={!canProceedFromAmount()}
        >
          <Text style={styles.nextButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderBankStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Bank Details</Text>
      <Text style={styles.stepSubtitle}>Select your bank and enter account details</Text>

      {/* Bank Search */}
      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Search Bank</Text>
        <TextInput
          style={styles.formInput}
          value={bankSearchQuery}
          onChangeText={setBankSearchQuery}
          placeholder="Search for your bank..."
          placeholderTextColor="#999"
        />
      </View>

      {/* Bank List */}
      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Select Bank</Text>
        {isLoadingBanks ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#FF6B00" />
            <Text style={styles.loadingText}>Loading banks...</Text>
          </View>
        ) : filteredBanks.length === 0 && banks.length > 0 ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>No banks found matching "{bankSearchQuery}"</Text>
          </View>
        ) : filteredBanks.length === 0 ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>No banks available</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={fetchBanks}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView style={styles.bankList} showsVerticalScrollIndicator={false}>
            {filteredBanks.slice(0, 10).map((bank) => (
              <TouchableOpacity
                key={bank.code}
                style={[
                  styles.bankOption,
                  selectedBank?.code === bank.code && styles.bankOptionActive,
                ]}
                onPress={() => {
                  setSelectedBank(bank);
                  setAccountName(''); // Reset account name when bank changes
                }}
              >
                <Text style={[
                  styles.bankOptionText,
                  selectedBank?.code === bank.code && styles.bankOptionTextActive,
                ]}>
                  {bank.name}
                </Text>
                {selectedBank?.code === bank.code && (
                  <FontAwesome name="check-circle" size={20} color="#25D366" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Account Number */}
      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Account Number</Text>
        <TextInput
          style={styles.formInput}
          value={accountNumber}
          onChangeText={(text) => {
            const cleaned = text.replace(/[^0-9]/g, '');
            if (cleaned.length <= 10) {
              setAccountNumber(cleaned);
              if (accountName) setAccountName(''); // Reset account name when number changes
            }
          }}
          placeholder="0123456789"
          placeholderTextColor="#999"
          keyboardType="numeric"
          maxLength={10}
        />
      </View>

      {/* Verify Button */}
      {selectedBank && accountNumber.length === 10 && !accountName && (
        <TouchableOpacity
          style={styles.verifyButton}
          onPress={verifyBankAccount}
          disabled={isVerifyingAccount}
        >
          {isVerifyingAccount ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.verifyButtonText}>Verify Account</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Account Name */}
      {accountName && (
        <View style={styles.accountNameContainer}>
          <FontAwesome name="check-circle" size={20} color="#25D366" />
          <Text style={styles.accountNameText}>{accountName}</Text>
        </View>
      )}

      <View style={styles.stepButtons}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setCurrentStep('amount')}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.nextButton, !canProceedFromBank() && styles.nextButtonDisabled]}
          onPress={() => setCurrentStep('confirm')}
          disabled={!canProceedFromBank()}
        >
          <Text style={styles.nextButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderConfirmStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Confirm Withdrawal</Text>
      <Text style={styles.stepSubtitle}>Review your withdrawal details</Text>

      <View style={styles.confirmationCard}>
        <View style={styles.confirmationRow}>
          <Text style={styles.confirmationLabel}>Amount:</Text>
          <Text style={styles.confirmationValue}>{coinAmount} {coinSymbol}</Text>
        </View>
        <View style={styles.confirmationRow}>
          <Text style={styles.confirmationLabel}>Bank:</Text>
          <Text style={styles.confirmationValue}>{selectedBank?.name}</Text>
        </View>
        <View style={styles.confirmationRow}>
          <Text style={styles.confirmationLabel}>Account:</Text>
          <Text style={styles.confirmationValue}>{accountNumber}</Text>
        </View>
        <View style={styles.confirmationRow}>
          <Text style={styles.confirmationLabel}>Account Name:</Text>
          <Text style={styles.confirmationValue}>{accountName}</Text>
        </View>
        {withdrawalCalculation && (
          <>
            <View style={styles.confirmationDivider} />
            <View style={styles.confirmationRow}>
              <Text style={styles.confirmationLabel}>USD Value:</Text>
              <Text style={styles.confirmationValue}>${withdrawalCalculation.usd_amount.toFixed(2)}</Text>
            </View>
            <View style={styles.confirmationRow}>
              <Text style={styles.confirmationLabel}>NGN Amount:</Text>
              <Text style={styles.confirmationValue}>₦{withdrawalCalculation.ngn_amount.toLocaleString()}</Text>
            </View>
            <View style={styles.confirmationRow}>
              <Text style={styles.confirmationLabel}>Fees:</Text>
              <Text style={styles.confirmationValue}>₦{withdrawalCalculation.fee_amount.toLocaleString()}</Text>
            </View>
            <View style={[styles.confirmationRow, styles.confirmationRowFinal]}>
              <Text style={styles.confirmationLabelFinal}>You'll Receive:</Text>
              <Text style={styles.confirmationValueFinal}>₦{withdrawalCalculation.final_amount.toLocaleString()}</Text>
            </View>
          </>
        )}
      </View>

      <View style={styles.stepButtons}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setCurrentStep('bank')}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.confirmButton, isProcessing && styles.confirmButtonDisabled]}
          onPress={processWithdrawal}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.confirmButtonText}>Confirm Withdrawal</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent={true}
    >
      <SafeAreaView style={styles.modalOverlay}>
        <TouchableOpacity 
          style={styles.modalBackdrop} 
          activeOpacity={1} 
          onPress={onClose}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingView}
        >
          <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Withdraw to Bank</Text>
            <TouchableOpacity onPress={onClose}>
              <FontAwesome name="times" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          {/* Step Indicator */}
          <View style={styles.stepIndicator}>
            {['currency', 'amount', 'bank', 'confirm'].map((step, index) => (
              <View key={step} style={styles.stepIndicatorContainer}>
                <View style={[
                  styles.stepIndicatorDot,
                  (currentStep === step || 
                   (['amount', 'bank', 'confirm'].includes(currentStep) && step === 'currency') ||
                   (['bank', 'confirm'].includes(currentStep) && step === 'amount') ||
                   (currentStep === 'confirm' && step === 'bank')
                  ) && styles.stepIndicatorDotActive
                ]} />
                {index < 3 && <View style={styles.stepIndicatorLine} />}
              </View>
            ))}
          </View>

          <ScrollView 
            style={styles.modalBody} 
            showsVerticalScrollIndicator={false}
            bounces={false}
            keyboardShouldPersistTaps="handled"
          >
            {currentStep === 'currency' && renderCurrencyStep()}
            {currentStep === 'amount' && renderAmountStep()}
            {currentStep === 'bank' && renderBankStep()}
            {currentStep === 'confirm' && renderConfirmStep()}
          </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const { height: screenHeight } = Dimensions.get('window');

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  keyboardAvoidingView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '95%',
    minHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 20 : 16,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  stepIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepIndicatorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#e0e0e0',
  },
  stepIndicatorDotActive: {
    backgroundColor: '#FF6B00',
  },
  stepIndicatorLine: {
    width: 30,
    height: 2,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 8,
  },
  modalBody: {
    flex: 1,
    padding: 16,
    paddingBottom: 0,
  },
  stepContent: {
    flex: 1,
    paddingBottom: 20,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  currencyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  currencyOptionActive: {
    backgroundColor: '#fff3e0',
    borderColor: '#FF6B00',
  },
  currencyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FF6B00',
    marginRight: 16,
    width: 32,
    textAlign: 'center',
  },
  currencyName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  currencyNameActive: {
    color: '#FF6B00',
  },
  currencyDesc: {
    fontSize: 14,
    color: '#666',
  },
  currencyDescActive: {
    color: '#FF6B00',
  },
  comingSoon: {
    fontSize: 12,
    color: '#999',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#000',
  },
  formHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  coinSelector: {
    marginTop: 8,
  },
  coinOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#f9f9f9',
    marginRight: 8,
    alignItems: 'center',
    minWidth: 80,
  },
  coinOptionActive: {
    backgroundColor: '#FF6B00',
    borderColor: '#FF6B00',
  },
  coinOptionText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
    marginBottom: 4,
  },
  coinOptionTextActive: {
    color: '#fff',
  },
  coinOptionBalance: {
    fontSize: 12,
    color: '#999',
  },
  coinOptionBalanceActive: {
    color: '#fff',
    opacity: 0.9,
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  errorText: {
    fontSize: 14,
    color: '#dc2626',
    marginBottom: 4,
  },
  calculationContainer: {
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  calculationText: {
    fontSize: 14,
    color: '#0369a1',
    marginLeft: 8,
  },
  calculationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0369a1',
    marginBottom: 12,
  },
  calculationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  calculationRowFinal: {
    borderTopWidth: 1,
    borderTopColor: '#bfdbfe',
    paddingTop: 8,
    marginTop: 8,
  },
  calculationLabel: {
    fontSize: 14,
    color: '#374151',
  },
  calculationValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  calculationLabelFinal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0369a1',
  },
  calculationValueFinal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0369a1',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  bankList: {
    maxHeight: 200,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  bankOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  bankOptionActive: {
    backgroundColor: '#fff3e0',
  },
  bankOptionText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  bankOptionTextActive: {
    color: '#FF6B00',
    fontWeight: '500',
  },
  verifyButton: {
    backgroundColor: '#0369a1',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  accountNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  accountNameText: {
    fontSize: 14,
    color: '#166534',
    marginLeft: 8,
    fontWeight: '500',
  },
  confirmationCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  confirmationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  confirmationRowFinal: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 12,
    marginTop: 8,
  },
  confirmationLabel: {
    fontSize: 14,
    color: '#666',
  },
  confirmationValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
  },
  confirmationLabelFinal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  confirmationValueFinal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF6B00',
  },
  confirmationDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 12,
  },
  stepButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  backButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  nextButton: {
    flex: 2,
    backgroundColor: '#FF6B00',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    opacity: 0.6,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 2,
    backgroundColor: '#dc2626',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  retryButton: {
    backgroundColor: '#FF6B00',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
