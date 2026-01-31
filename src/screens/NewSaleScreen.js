import React, { useState, useEffect, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, FlatList, StyleSheet, Switch } from 'react-native';
import { db, logAudit } from '../database/db'; 
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext'; 
import { FUEL_TYPES, VEHICLE_TYPES, PAYMENT_MODES } from '../utils/constants';

export default function NewSaleScreen({ navigation }) {
  const { user, theme } = useContext(AuthContext); 
  const [step, setStep] = useState(1); 
  
  // 🔍 Optimized Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState([]); 
  
  const [customer, setCustomer] = useState(null);
  const [activeOffers, setActiveOffers] = useState([]);
  
  const [buyPrice, setBuyPrice] = useState(0);

  const [txn, setTxn] = useState({ 
    vehicleNo: '', fuelType: 'Petrol', price: '100', qty: '', 
    payMode: 'Cash', offerId: null, discountVal: 0, redeemPoints: false, rating: 0, feedback: '',
    vehicleType: 'Car' 
  });

  useEffect(() => {
    (async () => {
      const oRes = await db.getAllAsync('SELECT * FROM offers WHERE is_active = 1');
      setActiveOffers(oRes);
      
      const tRes = await db.getAllAsync('SELECT * FROM tanks');
      const p = tRes.find(t=>t.fuel_type === 'Petrol');
      setTxn(prev => ({ ...prev, price: String(p?.sell_price || 100) }));
      
      searchCustomers('');
    })();
  }, []);

  useEffect(() => {
    fetchBuyPrice();
  }, [txn.fuelType]); 

  const searchCustomers = async (text) => {
    setSearchQuery(text);
    try {
        let query = 'SELECT * FROM customers ORDER BY id DESC LIMIT 10';
        let params = [];
        
        if(text.length > 0) {
            query = `SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? LIMIT 10`;
            params = [`%${text}%`, `%${text}%`];
        }
        
        const res = await db.getAllAsync(query, params);
        setCustomers(res);
    } catch(e) { console.log(e); }
  };

  const fetchBuyPrice = async () => {
    const tRes = await db.getAllAsync('SELECT buy_price FROM tanks WHERE fuel_type = ?', [txn.fuelType]);
    setBuyPrice(tRes[0]?.buy_price || 0);
  };

  const selectCustomer = async (cust) => {
    setCustomer(cust);
    const vRes = await db.getAllAsync('SELECT * FROM vehicles WHERE customer_id = ?', [cust.id]);
    if(vRes.length > 0) {
        setTxn({ ...txn, vehicleNo: vRes[0].vehicle_no, vehicleType: vRes[0].vehicle_type || 'Car' });
    }
    setStep(2);
  };

  const calculateTotal = () => {
    const qty = parseFloat(txn.qty);
    const price = parseFloat(txn.price);
    const baseAmount = (isNaN(qty) ? 0 : qty) * (isNaN(price) ? 0 : price);
    
    let discount = parseFloat(txn.discountVal || 0); 
    let pointsDiscount = 0;
    if (txn.redeemPoints && customer.loyalty_points > 0) {
      pointsDiscount = Math.floor(customer.loyalty_points / 10);
    }
    const final = baseAmount - discount - pointsDiscount;
    return { base: baseAmount, final: final > 0 ? final : 0, pointsDisc: pointsDiscount };
  };

  const checkForFraud = async () => {
    const qty = parseFloat(txn.qty);
    const warnings = [];
    if ((txn.vehicleType === 'Bike' || txn.vehicleType === 'Scooter') && qty > 15) {
        warnings.push(`⚠️ Suspicious Volume: ${qty}L for a ${txn.vehicleType}.`);
    }
    const lastTxn = await db.getAllAsync('SELECT * FROM transactions WHERE vehicle_no = ? ORDER BY id DESC LIMIT 1', [txn.vehicleNo]);
    if (lastTxn.length > 0) {
        const lastTime = new Date(lastTxn[0].date + 'T' + lastTxn[0].time); 
        const now = new Date();
        const diffMins = (now - lastTime) / 60000;
        if (diffMins < 10 && diffMins >= 0) {
            warnings.push(`⚠️ Frequency Alert: Vehicle refueled ${Math.floor(diffMins)} mins ago.`);
        }
    }
    return warnings;
  };

  const generateBill = async () => {
    if (!txn.vehicleNo) return Alert.alert("Error", "Enter Vehicle No");
    const qty = parseFloat(txn.qty);
    if (!qty || isNaN(qty) || qty <= 0) return Alert.alert("Error", "Enter valid quantity");

    const fraudWarnings = await checkForFraud();
    if (fraudWarnings.length > 0) {
        Alert.alert("🚨 POTENTIAL FRAUD", fraudWarnings.join('\n') + "\n\nProceed anyway?", [
            { text: "Cancel", style: "cancel" },
            { text: "Yes, Log & Proceed", onPress: () => processTransaction(true) }
        ]);
    } else {
        processTransaction(false);
    }
  };

  const processTransaction = async (isSuspicious) => {
    try {
        const { final, pointsDisc } = calculateTotal();
        const invoiceNo = "INV-" + Math.floor(Math.random() * 100000);
        const now = new Date();
        const saleQty = parseFloat(txn.qty);
        const pointsEarned = Math.floor(saleQty);
        
        const shiftRes = await db.getAllAsync('SELECT id FROM shifts WHERE user_id = ? AND status = "OPEN"', [user.id]);
        const shiftId = shiftRes.length > 0 ? shiftRes[0].id : null;

        // 🆕 UPDATED SQL: Added 'vehicle_type'
        await db.runAsync(`
        INSERT INTO transactions 
        (invoice_no, customer_id, vehicle_no, vehicle_type, fuel_type, quantity, price_per_liter, total_amount, discount_amount, payment_mode, points_earned, points_redeemed, date, time, operator_name, rating, feedback_note, buy_price, shift_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [invoiceNo, customer.id, txn.vehicleNo, txn.vehicleType, txn.fuelType, saleQty, txn.price, final, (txn.discountVal + pointsDisc), txn.payMode, pointsEarned, (txn.redeemPoints ? customer.loyalty_points : 0), now.toISOString().split('T')[0], now.toLocaleTimeString(), user.username, txn.rating, txn.feedback, buyPrice, shiftId]
        );

        if(txn.payMode === 'Credit' || customer.type === 'Credit') {
            const table = customer.company_id ? 'companies' : 'customers';
            const id = customer.company_id || customer.id;
            await db.runAsync(`UPDATE ${table} SET current_balance = current_balance + ? WHERE id = ?`, [final, id]);
        }
        
        let newPoints = txn.redeemPoints ? pointsEarned : customer.loyalty_points + pointsEarned;
        await db.runAsync('UPDATE customers SET loyalty_points = ? WHERE id = ?', [newPoints, customer.id]);
        await db.runAsync('UPDATE tanks SET current_level = current_level - ? WHERE fuel_type = ?', [saleQty, txn.fuelType]);

        const action = isSuspicious ? 'SUSPICIOUS_SALE' : 'NEW_SALE';
        await logAudit(user.username, action, `Inv: ${invoiceNo}, Amt: ${final}, Mode: ${txn.payMode}`);

        Alert.alert("✅ Bill Generated", `Invoice: ${invoiceNo}\nPaid via: ${txn.payMode}`, [{ text: "Done", onPress: () => navigation.navigate('Dashboard') }]);
    } catch (error) {
        Alert.alert("Transaction Failed", error.message);
    }
  };

  if(step === 1) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <View style={{padding: 15}}>
            <Text style={{fontWeight:'bold', fontSize:18, color: theme.text, marginBottom:10}}>Select Customer</Text>
            <View style={[styles.searchBox, {backgroundColor: theme.inputBg, borderColor: theme.border}]}>
                <Ionicons name="search" size={20} color={theme.subText} />
                <TextInput 
                   style={{flex:1, marginLeft:10, color: theme.text}}
                   placeholder="Search Name or Phone..."
                   placeholderTextColor={theme.subText}
                   value={searchQuery}
                   onChangeText={searchCustomers}
                />
            </View>
        </View>

        <FlatList data={customers} keyExtractor={item=>item.id.toString()}
          contentContainerStyle={{paddingBottom: 20}}
          renderItem={({item}) => (
            <TouchableOpacity style={[styles.listItem, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => selectCustomer(item)}>
              <Text style={{fontWeight:'bold', color: theme.text}}>{item.name}</Text>
              <Text style={{color: theme.subText}}>{item.phone}</Text>
            </TouchableOpacity>
          )} 
        />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.formContainer, { backgroundColor: theme.card }]}>
      <View style={[styles.section, { borderColor: theme.border }]}>
        <Text style={[styles.label, { color: theme.text }]}>Vehicle & Fuel</Text>
        <TextInput 
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.inputBg }]} 
            placeholder="Vehicle No" placeholderTextColor={theme.subText}
            value={txn.vehicleNo} onChangeText={t=>setTxn({...txn, vehicleNo:t})} 
        />
        
        <View style={{flexDirection:'row', marginBottom:15}}>
           {VEHICLE_TYPES.map(type => (
              <TouchableOpacity key={type} onPress={() => setTxn({...txn, vehicleType: type})} 
                style={[styles.smallChip, { borderColor: theme.border }, txn.vehicleType === type && styles.chipActive]}>
                 <Text style={{color: txn.vehicleType === type ? 'white' : theme.subText, fontSize:12}}>{type}</Text>
              </TouchableOpacity>
           ))}
        </View>

        <View style={{flexDirection:'row', marginBottom: 10}}>
           {FUEL_TYPES.map(t => (
             <TouchableOpacity key={t} onPress={() => setTxn(prev => ({...prev, fuelType: t}))}
               style={[styles.chip, { borderColor: theme.border }, txn.fuelType===t && styles.chipActive]}>
               <Text style={txn.fuelType===t?{color:'white'}:{color: theme.text}}>{t}</Text>
             </TouchableOpacity>
           ))}
        </View>

        <View style={{flexDirection:'row'}}>
           <TextInput 
             style={[styles.input, {flex:1, marginRight:5, color: theme.text, borderColor: theme.border, backgroundColor: theme.inputBg }]} 
             placeholderTextColor={theme.subText} keyboardType="numeric" placeholder="Price" value={txn.price} onChangeText={t=>setTxn({...txn, price:t})} 
           />
           <TextInput 
             style={[styles.input, {flex:1, marginLeft:5, color: theme.text, borderColor: theme.border, backgroundColor: theme.inputBg }]} 
             placeholderTextColor={theme.subText} keyboardType="numeric" placeholder="Qty (L)" value={txn.qty} onChangeText={t=>setTxn({...txn, qty:t})} 
           />
        </View>
      </View>

      <View style={[styles.section, { borderColor: theme.border }]}>
        <Text style={[styles.label, { color: theme.text }]}>Discounts & Offers</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:10}}>
          {activeOffers.map(offer => (
            <TouchableOpacity key={offer.id} 
              style={[styles.chip, { borderColor: theme.border }, txn.offerId === offer.id && styles.chipActive]}
              onPress={() => setTxn({...txn, offerId: offer.id, discountVal: offer.discount_value})}>
              <Text style={{color: txn.offerId === offer.id?'white': theme.text}}>{offer.title} (-₹{offer.discount_value})</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={() => setTxn({...txn, offerId: null, discountVal: 0})} style={[styles.chip, { borderColor: theme.border }]}><Text style={{color: theme.text}}>Clear</Text></TouchableOpacity>
        </ScrollView>
        <View style={styles.rowBetween}>
          <Text style={{color: theme.text}}>Redeem {customer.loyalty_points} Points? (-₹{Math.floor(customer.loyalty_points/10)})</Text>
          <Switch value={txn.redeemPoints} onValueChange={v => setTxn({...txn, redeemPoints:v})} disabled={customer.loyalty_points < 10} />
        </View>
      </View>

      <View style={[styles.section, { borderColor: theme.border }]}>
        <Text style={[styles.label, { color: theme.text }]}>Payment Method</Text>
        <View style={{flexDirection:'row', flexWrap:'wrap'}}>
           {PAYMENT_MODES.map(mode => (
              <TouchableOpacity key={mode} 
                style={[styles.chip, { borderColor: theme.border, marginBottom: 5 }, txn.payMode === mode && styles.chipActive]}
                onPress={() => setTxn({...txn, payMode: mode})}>
                 <Text style={{color: txn.payMode === mode ? 'white' : theme.text}}>{mode}</Text>
              </TouchableOpacity>
           ))}
        </View>
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={generateBill}>
        <Text style={styles.saveBtnText}>Complete Sale</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  formContainer: { padding: 15, flex: 1 },
  section: { marginBottom: 20, borderBottomWidth:1, paddingBottom:15 },
  label: { fontWeight: 'bold', marginBottom: 10, fontSize: 16 },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 16, marginBottom:10 },
  chip: { padding: 8, borderWidth: 1, borderRadius: 20, marginRight: 5 },
  smallChip: { paddingVertical: 5, paddingHorizontal: 10, borderWidth: 1, borderRadius: 15, marginRight: 5 },
  chipActive: { backgroundColor: '#2196f3', borderColor: '#2196f3' },
  saveBtn: { backgroundColor: '#2196f3', padding: 15, borderRadius: 8, alignItems: 'center', marginBottom: 40 },
  saveBtnText: { color: 'white', fontWeight: 'bold' },
  listItem: { padding: 15, borderBottomWidth: 1, marginHorizontal: 15, borderRadius: 8, marginBottom: 5 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  searchBox: { flexDirection:'row', alignItems:'center', borderWidth:1, borderRadius:8, padding:10, marginHorizontal:15, marginBottom:10 }
});