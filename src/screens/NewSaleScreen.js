import React, { useState, useEffect, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, FlatList, StyleSheet, Switch } from 'react-native';
import { db, logAudit } from '../database/db'; 
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext'; 
import * as Linking from 'expo-linking';

export default function NewSaleScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const [step, setStep] = useState(1); 
  const [customers, setCustomers] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [activeOffers, setActiveOffers] = useState([]);
  
  // Auto-Prices State
  const [defaultPrices, setDefaultPrices] = useState({ Petrol: '100', Diesel: '90' });

  const [txn, setTxn] = useState({ 
    vehicleNo: '', fuelType: 'Petrol', price: '100', qty: '', 
    payMode: 'Cash', offerId: null, discountVal: 0, redeemPoints: false, rating: 0, feedback: ''
  });

  useEffect(() => {
    (async () => {
      const cRes = await db.getAllAsync('SELECT * FROM customers');
      setCustomers(cRes);
      const oRes = await db.getAllAsync('SELECT * FROM offers WHERE is_active = 1');
      setActiveOffers(oRes);
      
      const tRes = await db.getAllAsync('SELECT * FROM tanks');
      const pPrice = tRes.find(t=>t.fuel_type === 'Petrol')?.sell_price || 100;
      const dPrice = tRes.find(t=>t.fuel_type === 'Diesel')?.sell_price || 90;
      setDefaultPrices({ Petrol: String(pPrice), Diesel: String(dPrice) });
      
      setTxn(prev => ({ ...prev, price: String(pPrice) }));
    })();
  }, []);

  useEffect(() => {
    if (defaultPrices[txn.fuelType]) {
      setTxn(prev => ({ ...prev, price: defaultPrices[txn.fuelType] }));
    }
  }, [txn.fuelType]);

  const selectCustomer = async (cust) => {
    setCustomer(cust);
    const vRes = await db.getAllAsync('SELECT * FROM vehicles WHERE customer_id = ?', [cust.id]);
    if(vRes.length > 0) setTxn({...txn, vehicleNo: vRes[0].vehicle_no});
    setStep(2);
  };

  const calculateTotal = () => {
    const baseAmount = parseFloat(txn.qty || 0) * parseFloat(txn.price || 0);
    let discount = txn.discountVal; 
    let pointsDiscount = 0;
    if (txn.redeemPoints && customer.loyalty_points > 0) {
      pointsDiscount = Math.floor(customer.loyalty_points / 10);
    }
    const final = baseAmount - discount - pointsDiscount;
    return { base: baseAmount, final: final > 0 ? final : 0, pointsDisc: pointsDiscount };
  };

  const sendReceipt = (inv, amount, points) => {
    const msg = `⛽ Fuel Station Receipt\n\nInv: ${inv}\nVehicle: ${txn.vehicleNo}\nAmount: ₹${amount}\nPoints Earned: ${points}\n\nThank you for visiting!`;
    const url = `whatsapp://send?text=${encodeURIComponent(msg)}&phone=${customer.phone}`;
    Linking.openURL(url).catch(() => { Alert.alert("Error", "WhatsApp not installed"); });
  };

  const generateBill = async () => {
    if (!txn.vehicleNo) return Alert.alert("Validation Error", "Please enter Vehicle Number");
    if (parseFloat(txn.qty) <= 0 || isNaN(parseFloat(txn.qty))) return Alert.alert("Validation Error", "Invalid Quantity");
    if (parseFloat(txn.price) <= 0) return Alert.alert("Validation Error", "Invalid Price");

    const { final, pointsDisc } = calculateTotal();
    
    if ((txn.payMode === 'Credit' || customer.type === 'Credit') && customer.credit_limit > 0) {
       const newBalance = customer.current_balance + final;
       if (newBalance > customer.credit_limit) {
         Alert.alert("⚠️ Credit Limit Exceeded", `Transaction blocked.\nNew Balance (₹${newBalance}) exceeds limit (₹${customer.credit_limit})`);
         return;
       }
    }

    const invoiceNo = "INV-" + Math.floor(Math.random() * 100000);
    const now = new Date();
    const pointsEarned = Math.floor(parseFloat(txn.qty));
    const tankRes = await db.getAllAsync('SELECT buy_price FROM tanks WHERE fuel_type = ?', [txn.fuelType]);
    const currentBuyPrice = tankRes[0]?.buy_price || 0;

    await db.runAsync(`
      INSERT INTO transactions 
      (invoice_no, customer_id, vehicle_no, fuel_type, quantity, price_per_liter, total_amount, discount_amount, payment_mode, points_earned, points_redeemed, date, time, operator_name, rating, feedback_note, buy_price)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [invoiceNo, customer.id, txn.vehicleNo, txn.fuelType, txn.qty, txn.price, final, (txn.discountVal + pointsDisc), txn.payMode, pointsEarned, (txn.redeemPoints ? customer.loyalty_points : 0), now.toISOString().split('T')[0], now.toLocaleTimeString(), user.username, txn.rating, txn.feedback, currentBuyPrice]
    );

    let newBalance = customer.current_balance;
    if(txn.payMode === 'Credit' || customer.type === 'Credit') {
      newBalance += final;
    }
    let newPoints = customer.loyalty_points + pointsEarned;
    if(txn.redeemPoints) newPoints = 0 + pointsEarned; 

    await db.runAsync('UPDATE customers SET current_balance = ?, loyalty_points = ? WHERE id = ?', [newBalance, newPoints, customer.id]);
    await logAudit(user.username, 'NEW_SALE', `Inv: ${invoiceNo}, Amt: ${final}`);
    await db.runAsync('UPDATE tanks SET current_level = current_level - ? WHERE fuel_type = ?', [parseFloat(txn.qty), txn.fuelType]);

    Alert.alert("✅ Bill Generated", `Invoice: ${invoiceNo}\nNet Pay: ₹${final.toFixed(2)}`, [
        { text: "Done", onPress: () => navigation.navigate('Dashboard') },
        { text: "Send WhatsApp", onPress: () => { sendReceipt(invoiceNo, final.toFixed(2), pointsEarned); navigation.navigate('Dashboard'); }}
    ]);
  };

  if(step === 1) {
    return (
      <View style={styles.container}>
        <Text style={{padding:15, fontWeight:'bold', fontSize:18}}>Select Customer</Text>
        <FlatList data={customers} keyExtractor={item=>item.id.toString()}
          renderItem={({item}) => (
            <TouchableOpacity style={styles.listItem} onPress={() => selectCustomer(item)}>
              <Text style={{fontWeight:'bold'}}>{item.name}</Text>
              <Text>{item.phone} • ⭐ {item.loyalty_points} Pts</Text>
            </TouchableOpacity>
          )} 
        />
      </View>
    );
  }

  const { base, final, pointsDisc } = calculateTotal();

  return (
    <ScrollView style={styles.formContainer}>
      
      {/* 🎁 LOYALTY SUGGESTION */}
      {customer.loyalty_points >= 50 && (
        <View style={styles.suggestionBox}>
           <Ionicons name="bulb" size={24} color="#ff9800" />
           <View style={{marginLeft:10, flex:1}}>
              <Text style={{fontWeight:'bold', color:'#e65100'}}>Loyalty Suggestion!</Text>
              <Text style={{fontSize:12, color:'#e65100'}}>Customer has {customer.loyalty_points} points. Ask them if they want to redeem ₹{Math.floor(customer.loyalty_points/10)} discount!</Text>
           </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.label}>Vehicle & Fuel</Text>
        
        <View style={{flexDirection:'row', alignItems:'center'}}>
          <TextInput 
            style={[styles.input, {flex:1}]} 
            placeholder="Vehicle No" 
            placeholderTextColor="#999"
            value={txn.vehicleNo} 
            onChangeText={t=>setTxn({...txn, vehicleNo:t})} 
          />
          <TouchableOpacity style={{backgroundColor:'#2196f3', padding:10, borderRadius:8, marginLeft:5, marginBottom:10}}
             onPress={() => navigation.navigate('QRScanner', { onScan: (data) => setTxn(prev => ({...prev, vehicleNo: data})) })}>
             <Ionicons name="qr-code" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* Fuel Type Switcher */}
        <View style={{flexDirection:'row', marginBottom: 10}}>
           {['Petrol', 'Diesel'].map(t => (
             <TouchableOpacity key={t} onPress={() => setTxn(prev => ({...prev, fuelType: t}))}
               style={[styles.chip, txn.fuelType===t && styles.chipActive]}
             >
               <Text style={txn.fuelType===t?{color:'white'}:{color:'black'}}>{t}</Text>
             </TouchableOpacity>
           ))}
        </View>

        <View style={{flexDirection:'row'}}>
           <TextInput 
             style={[styles.input, {flex:1, marginRight:5}]} 
             keyboardType="numeric" 
             placeholder="Price" 
             placeholderTextColor="#999"
             value={txn.price} 
             onChangeText={t=>setTxn({...txn, price:t})} 
           />
           <TextInput 
             style={[styles.input, {flex:1, marginLeft:5}]} 
             keyboardType="numeric" 
             placeholder="Qty (L)" 
             placeholderTextColor="#999"
             value={txn.qty.toString()} 
             onChangeText={t=>setTxn({...txn, qty:t})} 
           />
        </View>
        
        {/* ❌ REMOVED "Fetch from Dispenser" BUTTON HERE */}

      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Discounts & Loyalty</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:10}}>
          {activeOffers.map(offer => (
            <TouchableOpacity key={offer.id} 
              style={[styles.chip, txn.offerId === offer.id && styles.chipActive]}
              onPress={() => setTxn({...txn, offerId: offer.id, discountVal: offer.discount_value})}>
              <Text style={{color: txn.offerId === offer.id?'white':'black'}}>{offer.title} (-₹{offer.discount_value})</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={() => setTxn({...txn, offerId: null, discountVal: 0})} style={styles.chip}><Text>Clear</Text></TouchableOpacity>
        </ScrollView>
        <View style={styles.rowBetween}>
          <Text>Redeem {customer.loyalty_points} Points? (-₹{Math.floor(customer.loyalty_points/10)})</Text>
          <Switch value={txn.redeemPoints} onValueChange={v => setTxn({...txn, redeemPoints:v})} disabled={customer.loyalty_points < 10} />
        </View>
      </View>

      <View style={styles.totalBox}>
        <Text style={{color:'#666'}}>Subtotal: ₹{base.toFixed(2)}</Text>
        <Text style={{color:'green'}}>Discount: -₹{(txn.discountVal + pointsDisc).toFixed(2)}</Text>
        <Text style={styles.finalPrice}>Pay: ₹ {final.toFixed(2)}</Text>
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={generateBill}>
        <Text style={styles.saveBtnText}>Complete Sale</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  formContainer: { padding: 15, backgroundColor: '#fff', flex: 1 },
  section: { marginBottom: 20, borderBottomWidth:1, borderBottomColor:'#eee', paddingBottom:15 },
  label: { fontWeight: 'bold', marginBottom: 10, fontSize: 16 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 16, marginBottom:10 },
  chip: { padding: 8, borderWidth: 1, borderColor: '#ddd', borderRadius: 20, marginRight: 5 },
  chipActive: { backgroundColor: '#2196f3', borderColor: '#2196f3' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalBox: { backgroundColor:'#e3f2fd', padding:15, borderRadius:8, alignItems:'center', marginBottom:20 },
  finalPrice: { fontSize: 28, fontWeight: 'bold', color: '#2196f3', marginTop: 5 },
  saveBtn: { backgroundColor: '#2196f3', padding: 15, borderRadius: 8, alignItems: 'center', marginBottom: 40 },
  saveBtnText: { color: 'white', fontWeight: 'bold' },
  listItem: { padding: 15, borderBottomWidth: 1, borderColor: '#eee', backgroundColor:'white' },
  // Suggestion Styles
  suggestionBox: { flexDirection:'row', backgroundColor:'#fff3e0', padding:15, borderRadius:10, marginBottom:20, alignItems:'center', borderWidth:1, borderColor:'#ffb74d' }
});