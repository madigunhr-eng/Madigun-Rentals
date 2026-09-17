import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, 
  Clock, 
  Calendar, 
  MapPin, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  X,
  History,
  TimerReset,
  FileText,
  Trash2
} from 'lucide-react';
import { InventoryItem, UserSession, TransmittalItem, Transmittal } from '../types';

interface RentalHallsProps {
  inventory: InventoryItem[];
  transmittals?: Transmittal[];
  currentUser: UserSession | null;
  onAddItem: (itemData: Omit<InventoryItem, 'id' | 'createdAt'>) => Promise<void>;
  onUpdateItem: (id: string, updates: Partial<InventoryItem>) => Promise<void>;
  onDeleteItem?: (id: string) => Promise<void>;
  onSubmitTransmittal: (transmittalData: {
    handler: string;
    rentee: string;
    address: string;
    dateCheckout: string;
    dateCheckin: string;
    items: TransmittalItem[];
    notes: string;
  }) => Promise<void>;
  onExtendTransmittal?: (
    transmittalId: string,
    additionalHours: number,
    additionalCost: number,
    extensionNote: string
  ) => Promise<void>;
  onNavigateToTransmittals: () => void;
}

export default function RentalHalls({
  inventory,
  transmittals = [],
  currentUser,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onSubmitTransmittal,
  onExtendTransmittal,
  onNavigateToTransmittals
}: RentalHallsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHall, setSelectedHall] = useState<InventoryItem | null>(null);
  const [deletingHall, setDeletingHall] = useState<InventoryItem | null>(null);
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Booking Modal Form State
  const [handlerName, setHandlerName] = useState(currentUser?.fullName || currentUser?.username || 'Events Desk');
  const [renteeName, setRenteeName] = useState('');
  const [eventAddress, setEventAddress] = useState('');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  // Duration Mode: 'Days' (Multi-Day Rental) or 'Hours' (Hourly Rental)
  const [durationMode, setDurationMode] = useState<'Days' | 'Hours'>('Days');
  const [rentalDays, setRentalDays] = useState<number>(1);
  const [rentalHours, setRentalHours] = useState<number>(4);
  const [customDailyRate, setCustomDailyRate] = useState<number>(18000);
  const [customHourlyRate, setCustomHourlyRate] = useState<number>(2500);

  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Exact Start Time State (AM / PM)
  const [startTimeHour, setStartTimeHour] = useState<number>(9);
  const [startTimeMinute, setStartTimeMinute] = useState<string>('00');
  const [startAmPm, setStartAmPm] = useState<'AM' | 'PM'>('AM');

  // Exact Return/Check-in Time State (AM / PM)
  const [endTimeHour, setEndTimeHour] = useState<number>(12);
  const [endTimeMinute, setEndTimeMinute] = useState<string>('00');
  const [endAmPm, setEndAmPm] = useState<'AM' | 'PM'>('PM');

  // Additional hourly items & corkage fees added to the booking
  const [extraItems, setExtraItems] = useState<{ itemId: string; quantity: number }[]>([]);

  // Extension Modal State
  const [isExtendModalOpen, setIsExtendModalOpen] = useState(false);
  const [selectedTxToExtend, setSelectedTxToExtend] = useState<Transmittal | null>(null);
  const [extensionMode, setExtensionMode] = useState<'Days' | 'Hours'>('Days');
  const [extensionDays, setExtensionDays] = useState<number>(1);
  const [extensionHours, setExtensionHours] = useState<number>(2);
  const [extensionRate, setExtensionRate] = useState<number>(18000);
  const [extensionReason, setExtensionReason] = useState('Guest requested extension of venue rental duration');
  const [isExtending, setIsExtending] = useState(false);

  // Helper to check if a venue hall has an ongoing transmittal for a given date range
  const getOngoingBookingForVenue = (hall: InventoryItem, rangeStartStr?: string, rangeEndStr?: string) => {
    return transmittals.find(t => {
      if (t.status === 'Returned') return false;

      const matchesHall = t.items.some(it => 
        it.itemId === hall.id || 
        it.sku === hall.sku || 
        (it.name && (it.name.toLowerCase().includes(hall.name.toLowerCase()) || it.name.includes(hall.sku)))
      );

      if (!matchesHall) return false;
      if (!rangeStartStr) return true; // Any active transmittal for this hall

      // Check date interval overlap
      const txStart = t.dateCheckout ? t.dateCheckout.split(' ')[0].split('T')[0] : '';
      const txEnd = t.dateCheckin ? t.dateCheckin.split(' ')[0].split('T')[0] : txStart;

      if (!txStart) return true;
      const chkStart = rangeStartStr;
      const chkEnd = rangeEndStr || rangeStartStr;

      // Interval overlap: [chkStart, chkEnd] overlaps [txStart, txEnd]
      return chkStart <= txEnd && chkEnd >= txStart;
    });
  };

  // Helper to calculate exact schedule start & end date/time formatted with AM/PM for both Days and Hours
  const getScheduleDetails = (
    mode: 'Days' | 'Hours',
    startDateStr: string,
    endDateStr: string,
    h12Start: number,
    minStartStr: string,
    amPmStart: 'AM' | 'PM',
    h12End: number,
    minEndStr: string,
    amPmEnd: 'AM' | 'PM',
    daysCount: number,
    hoursCount: number
  ) => {
    const minStart = parseInt(minStartStr, 10) || 0;
    let hStart24 = h12Start;
    if (amPmStart === 'PM' && h12Start < 12) hStart24 += 12;
    if (amPmStart === 'AM' && h12Start === 12) hStart24 = 0;

    const startParts = (startDateStr || '').split('-').map(Number);
    const sy = startParts[0] || 2026;
    const sm = startParts[1] || 1;
    const sd = startParts[2] || 1;

    const startDateTime = new Date(sy, sm - 1, sd, hStart24, minStart, 0);

    let endDateTime: Date;
    let effectiveHours: number;
    let effectiveDays: number;

    const formatAmPmStr = (d: Date) => {
      let h = d.getHours();
      const m = d.getMinutes().toString().padStart(2, '0');
      const ap = h >= 12 ? 'PM' : 'AM';
      h = h % 12;
      if (h === 0) h = 12;
      const hStr = h.toString().padStart(2, '0');
      return `${hStr}:${m} ${ap}`;
    };

    const formatDateOnly = (d: Date) => {
      const y = d.getFullYear();
      const m = (d.getMonth() + 1).toString().padStart(2, '0');
      const day = d.getDate().toString().padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    if (mode === 'Days') {
      const days = Math.max(1, Number(daysCount) || 1);
      effectiveDays = days;
      effectiveHours = days * 24;

      const minEnd = parseInt(minEndStr, 10) || 0;
      let hEnd24 = h12End;
      if (amPmEnd === 'PM' && h12End < 12) hEnd24 += 12;
      if (amPmEnd === 'AM' && h12End === 12) hEnd24 = 0;

      const endParts = (endDateStr || '').split('-').map(Number);
      const ey = endParts[0] || sy;
      const em = endParts[1] || sm;
      const ed = endParts[2] || (sd + days);

      endDateTime = new Date(ey, em - 1, ed, hEnd24, minEnd, 0);
      if (endDateTime.getTime() <= startDateTime.getTime()) {
        endDateTime = new Date(startDateTime.getTime() + days * 24 * 60 * 60 * 1000);
      }
    } else {
      const hours = Math.max(1, Number(hoursCount) || 1);
      effectiveHours = hours;
      effectiveDays = Math.ceil(hours / 24);
      endDateTime = new Date(startDateTime.getTime() + hours * 60 * 60 * 1000);
    }

    const startTimeDisplay = formatAmPmStr(startDateTime);
    const endTimeDisplay = formatAmPmStr(endDateTime);
    const startDateOnly = formatDateOnly(startDateTime);
    const endDateOnly = formatDateOnly(endDateTime);
    const startStr = `${startDateOnly} ${startTimeDisplay}`;
    const endStr = `${endDateOnly} ${endTimeDisplay}`;

    return {
      startDateTime,
      endDateTime,
      startStr,
      endStr,
      startDateOnly,
      endDateOnly,
      startTimeDisplay,
      endTimeDisplay,
      effectiveHours,
      effectiveDays
    };
  };

  // Filter for hall venues
  const halls = inventory.filter(item => 
    item.category === 'Rental Halls & Event Venues' || 
    (item.isHourlyCharged && (
      item.name.toLowerCase().includes('hall') || 
      item.name.toLowerCase().includes('ballroom') || 
      item.name.toLowerCase().includes('venue') || 
      item.name.toLowerCase().includes('terrace') || 
      item.name.toLowerCase().includes('pavilion')
    ))
  ).filter(h => h.name.toLowerCase().includes(searchQuery.toLowerCase()) || h.sku.toLowerCase().includes(searchQuery.toLowerCase()));

  // Active hall venue bookings / transmittals
  const activeVenueBookings = transmittals.filter(t => {
    if (t.status === 'Returned') return false;
    // Check if transmittal contains any hall or hourly items
    const hasHallOrHourly = t.items.some(item => {
      const inv = inventory.find(i => i.id === item.itemId || i.sku === item.sku);
      return inv?.category === 'Rental Halls & Event Venues' || inv?.isHourlyCharged || item.name.toLowerCase().includes('hall') || item.name.toLowerCase().includes('hrs') || item.name.toLowerCase().includes('day');
    });
    return hasHallOrHourly || t.notes.toLowerCase().includes('hall') || t.notes.toLowerCase().includes('hourly') || t.notes.toLowerCase().includes('multi-day');
  });

  // Other hourly rental items in inventory (non-hall items)
  const hourlyItems = inventory.filter(i => 
    i.id !== selectedHall?.id && 
    (i.isHourlyCharged || i.category === 'Corkage & Service Permits' || i.isNoQuantity)
  );

  // Form state for creating a new Hall venue
  const [newHallData, setNewHallData] = useState({
    name: '',
    sku: `HALL-${Math.floor(1000 + Math.random() * 9000)}`,
    location: '',
    rentalPrice: 3000,
    dailyRentalPrice: 20000,
  });

  // Open booking modal for a specific hall
  const handleOpenBookModal = (hall: InventoryItem) => {
    setSelectedHall(hall);
    setRenteeName('');
    setEventAddress(hall.location || 'Madigun Hotel Event Premises');
    const today = new Date().toISOString().split('T')[0];
    setEventDate(today);

    // Default to 1 day multi-day booking
    const parts = today.split('-').map(Number);
    const endD = new Date(parts[0], parts[1] - 1, parts[2] + 1);
    const ey = endD.getFullYear();
    const em = (endD.getMonth() + 1).toString().padStart(2, '0');
    const ed = endD.getDate().toString().padStart(2, '0');
    setEndDate(`${ey}-${em}-${ed}`);

    setDurationMode('Days');
    setRentalDays(1);
    setRentalHours(24);
    setStartTimeHour(9);
    setStartTimeMinute('00');
    setStartAmPm('AM');
    setEndTimeHour(12);
    setEndTimeMinute('00');
    setEndAmPm('PM');

    const hourly = Number(hall.rentalPrice || 2500);
    const daily = Number(hall.dailyRentalPrice || (hourly > 0 ? hourly * 8 : 18000));
    setCustomHourlyRate(hourly);
    setCustomDailyRate(daily);

    setNotes(`Venue Rental: ${hall.name} (${hall.sku})`);
    setExtraItems([]);
    setErrorMsg('');
    setIsBookModalOpen(true);
  };

  // Open extension modal for an active transmittal
  const handleOpenExtendModal = (tx: Transmittal) => {
    setSelectedTxToExtend(tx);
    setExtensionMode('Days');
    setExtensionDays(1);
    setExtensionHours(2);
    
    // Find rate from items in transmittal
    let defaultHourly = 2500;
    let defaultDaily = 18000;
    for (const item of tx.items) {
      const invItem = inventory.find(i => i.id === item.itemId || i.sku === item.sku);
      if (invItem) {
        if (Number(invItem.rentalPrice) > 0) defaultHourly = Number(invItem.rentalPrice);
        if (Number(invItem.dailyRentalPrice) > 0) defaultDaily = Number(invItem.dailyRentalPrice);
        else defaultDaily = defaultHourly * 8;
        break;
      }
    }
    setExtensionRate(defaultDaily);
    setExtensionReason('Guest requested extension of venue rental duration');
    setErrorMsg('');
    setIsExtendModalOpen(true);
  };

  // Submit Hall Booking
  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHall) return;
    if (!renteeName.trim()) return setErrorMsg('Rentee / Guest name is required');
    if (!eventAddress.trim()) return setErrorMsg('Event location address is required');

    if (durationMode === 'Days' && (rentalDays < 1)) {
      return setErrorMsg('Rental duration must be at least 1 day');
    }
    if (durationMode === 'Hours' && (rentalHours < 1)) {
      return setErrorMsg('Rental duration must be at least 1 hour');
    }

    const schedule = getScheduleDetails(
      durationMode,
      eventDate,
      endDate,
      startTimeHour,
      startTimeMinute,
      startAmPm,
      endTimeHour,
      endTimeMinute,
      endAmPm,
      rentalDays,
      rentalHours
    );

    // Check if venue has an ongoing transmittal for the selected date interval
    const dateCollisionTx = getOngoingBookingForVenue(selectedHall, schedule.startDateOnly, schedule.endDateOnly);
    if (dateCollisionTx) {
      return setErrorMsg(`CANNOT BOOK: Venue "${selectedHall.name}" already has an ongoing transmittal booking (${dateCollisionTx.transmittalNo} for ${dateCollisionTx.rentee}) during ${schedule.startDateOnly} to ${schedule.endDateOnly}.`);
    }

    const hallDurationDesc = durationMode === 'Days'
      ? `${rentalDays} Day(s) @ ₱${customDailyRate.toLocaleString()}/day`
      : `${rentalHours} hrs @ ₱${customHourlyRate.toLocaleString()}/hr`;

    // Build items list for Transmittal
    const transmittalItems: TransmittalItem[] = [
      {
        itemId: selectedHall.id,
        name: `${selectedHall.name} (${hallDurationDesc}: ${schedule.startDateOnly} ${schedule.startTimeDisplay} - ${schedule.endDateOnly} ${schedule.endTimeDisplay})`,
        sku: selectedHall.sku,
        quantity: 1,
        returnedQuantity: 0
      }
    ];

    // Add extra items / corkage fees
    extraItems.forEach(ei => {
      const invItem = inventory.find(i => i.id === ei.itemId);
      if (invItem && ei.quantity > 0) {
        const isHourly = invItem.isHourlyCharged;
        const rate = Number(invItem.rentalPrice || 0);
        const itemLabel = isHourly 
          ? `${invItem.name} (${durationMode === 'Days' ? `${rentalDays * 24} hrs` : `${rentalHours} hrs`} @ ₱${rate}/hr)`
          : `${invItem.name} (₱${rate} fee)`;

        transmittalItems.push({
          itemId: invItem.id,
          name: itemLabel,
          sku: invItem.sku,
          quantity: ei.quantity,
          returnedQuantity: 0
        });
      }
    });

    try {
      setIsSubmitting(true);

      const bookingTypeLabel = durationMode === 'Days' 
        ? `MULTI-DAY VENUE RENTAL (${rentalDays} Day(s))` 
        : `HOURLY VENUE RENTAL (${rentalHours} Hours)`;

      await onSubmitTransmittal({
        handler: handlerName,
        rentee: renteeName,
        address: eventAddress,
        dateCheckout: schedule.startStr,
        dateCheckin: schedule.endStr,
        items: transmittalItems,
        notes: `${bookingTypeLabel} from ${schedule.startStr} to ${schedule.endStr}. Estimated Total: ₱${calculateGrandTotal().toLocaleString()}. ${notes}`
      });

      setIsBookModalOpen(false);
      setIsSubmitting(false);
      setSuccessMsg(`Booking confirmed for ${selectedHall.name} (${schedule.startStr} - ${schedule.endStr})! Redirecting to Transmittals...`);
      setTimeout(() => {
        onNavigateToTransmittals();
      }, 1500);

    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to complete hall booking');
      setIsSubmitting(false);
    }
  };

  // Confirm rental duration extension (Days or Hours)
  const handleConfirmExtension = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTxToExtend) return;
    
    let totalExtCost = 0;
    let addlHours = 0;
    let modeLabel = '';

    if (extensionMode === 'Days') {
      if (extensionDays < 1) return setErrorMsg('Extension days must be at least 1 day');
      totalExtCost = extensionDays * extensionRate;
      addlHours = extensionDays * 24;
      modeLabel = `+${extensionDays} Day(s)`;
    } else {
      if (extensionHours < 1) return setErrorMsg('Extension hours must be at least 1 hour');
      totalExtCost = extensionHours * extensionRate;
      addlHours = extensionHours;
      modeLabel = `+${extensionHours} Hour(s)`;
    }

    if (extensionRate < 0) return setErrorMsg('Rate must be a valid non-negative number');

    try {
      setIsExtending(true);
      if (onExtendTransmittal) {
        await onExtendTransmittal(selectedTxToExtend.id, addlHours, totalExtCost, `${modeLabel} - ${extensionReason}`);
      }
      setIsExtendModalOpen(false);
      setIsExtending(false);
      setSuccessMsg(`Successfully extended ${selectedTxToExtend.transmittalNo} by ${modeLabel} (+₱${totalExtCost.toLocaleString()})!`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg('Failed to extend rental duration: ' + err.message);
      setIsExtending(false);
    }
  };

  // Calculate booking breakdown
  const calculateHallTotal = () => {
    if (!selectedHall) return 0;
    if (durationMode === 'Days') {
      return Number(customDailyRate || 0) * Math.max(1, Number(rentalDays) || 1);
    } else {
      return Number(customHourlyRate || 0) * Math.max(1, Number(rentalHours) || 1);
    }
  };

  const calculateExtrasTotal = () => {
    let sum = 0;
    const durationMultiplier = durationMode === 'Days' 
      ? Math.max(1, Number(rentalDays) || 1) 
      : Math.max(1, Number(rentalHours) || 1);

    extraItems.forEach(ei => {
      const item = inventory.find(i => i.id === ei.itemId);
      if (item) {
        const rate = Number(item.rentalPrice || 0);
        if (item.isHourlyCharged) {
          sum += rate * (durationMode === 'Days' ? (durationMultiplier * 24) : durationMultiplier) * ei.quantity;
        } else {
          sum += rate * ei.quantity;
        }
      }
    });
    return sum;
  };

  const calculateGrandTotal = () => {
    return calculateHallTotal() + calculateExtrasTotal();
  };

  // Add new custom hall
  const handleCreateHall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHallData.name.trim()) return setErrorMsg('Hall name is required');
    try {
      await onAddItem({
        name: newHallData.name,
        sku: newHallData.sku || `HALL-${Math.floor(1000 + Math.random() * 9000)}`,
        category: 'Rental Halls & Event Venues',
        quantityTotal: 1,
        quantityAvailable: 1,
        status: 'In Stock',
        location: newHallData.location || 'Madigun Hotel Events Center',
        rentalPrice: Number(newHallData.rentalPrice || 0),
        dailyRentalPrice: Number(newHallData.dailyRentalPrice || 0),
        price: 0,
        isHourlyCharged: true,
        isNoQuantity: true,
        chargeType: 'Daily'
      });
      setIsAddModalOpen(false);
      setSuccessMsg(`Added new event venue: ${newHallData.name}`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg('Failed to create hall: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-white border border-zinc-200 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-amber-100 text-amber-900 border border-amber-300">
                <Building2 className="h-5 w-5 text-amber-700" />
              </span>
              <div>
                <h1 className="text-xl font-black font-display text-zinc-900 uppercase tracking-wider">
                  Rental Halls & Event Venues
                </h1>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {(currentUser?.role === 'Admin' || currentUser?.role === 'Managing Director') && (
              <button
                id="btn-add-event-venue"
                onClick={() => {
                  setNewHallData({
                    name: '',
                    sku: `HALL-${Math.floor(1000 + Math.random() * 9000)}`,
                    location: 'Main Hotel Building',
                    rentalPrice: 3000,
                  });
                  setIsAddModalOpen(true);
                }}
                className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-white bg-zinc-900 hover:bg-zinc-800 transition-colors cursor-pointer flex items-center shrink-0"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Add Event Venue
              </button>
            )}
          </div>
        </div>

        {/* Notifications */}
        {successMsg && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold uppercase tracking-wider flex items-center">
            <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-600 shrink-0" />
            {successMsg}
          </div>
        )}

        {/* Search */}
        <div className="mt-6 relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-400">
            <Search className="h-4 w-4" />
          </span>
          <input
            id="input-search-halls"
            type="text"
            placeholder="Search venue halls by name, location, SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-zinc-200 text-xs font-semibold uppercase tracking-wider bg-zinc-50 focus:bg-white focus:outline-none focus:border-zinc-900 transition-all text-zinc-800"
          />
        </div>
      </div>

      {/* Active Venue Bookings & Rental Hours Extension Section */}
      {activeVenueBookings.length > 0 && (
        <div className="bg-zinc-950 text-white border border-zinc-800 p-6 space-y-4 shadow-sm">
          <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <TimerReset className="h-5 w-5 text-amber-400" />
              <h2 className="text-sm font-black uppercase tracking-wider text-zinc-100">
                Active Venue Rentals ({activeVenueBookings.length}) — Multi-Day & Hourly Extensions
              </h2>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest bg-zinc-900 text-amber-300 px-2.5 py-1 border border-zinc-700">
              Live Duration Tracker
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeVenueBookings.map(tx => (
              <div 
                key={tx.id} 
                className="bg-zinc-900/90 border border-zinc-800 p-4 flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-black text-amber-300 font-mono">
                      {tx.transmittalNo}
                    </span>
                    <span className="text-[9px] font-extrabold uppercase tracking-widest px-1.5 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-700">
                      {tx.status}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white uppercase tracking-tight mt-1">
                    {tx.rentee}
                  </h3>

                  <div className="text-[10px] text-zinc-300 space-y-1 mt-2 font-mono">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Date Out:</span>
                      <span>{tx.dateCheckout}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Current Check-in:</span>
                      <span className="text-emerald-300 font-bold">{tx.dateCheckin}</span>
                    </div>
                  </div>

                  <div className="mt-3 text-[11px] bg-zinc-950 p-2 border border-zinc-800 text-zinc-300 space-y-1">
                    <span className="text-[9px] font-bold text-amber-400 uppercase tracking-widest block">Booked Items:</span>
                    {tx.items.map((it, idx) => (
                      <div key={idx} className="truncate font-mono font-medium">
                        • {it.name}
                      </div>
                    ))}
                  </div>

                  {tx.notes && (
                    <p className="text-[10px] text-zinc-400 mt-2 line-clamp-2 italic font-mono bg-zinc-950/60 p-1.5 border border-zinc-800">
                      {tx.notes}
                    </p>
                  )}
                </div>

                {currentUser?.role !== 'Managing Director' && (
                  <button
                    id={`btn-extend-hours-${tx.id}`}
                    onClick={() => handleOpenExtendModal(tx)}
                    className="w-full py-2 px-3 text-xs font-bold uppercase tracking-wider text-zinc-950 bg-amber-400 hover:bg-amber-300 border border-amber-300 transition-colors cursor-pointer flex items-center justify-center font-mono shadow-xs"
                  >
                    <Clock className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                    Extend Venue Rental (Days / Hours)
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Venues Grid */}
      {halls.length === 0 ? (
        <div className="bg-white border border-zinc-200 p-12 text-center">
          <Building2 className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-zinc-700 uppercase tracking-wider">No Event Halls Registered</h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto">
            Click "Add Event Venue" to register a hall or event space with hourly billing rates.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {halls.map((hall) => {
            const hourlyRate = Number(hall.rentalPrice || 0);
            const dailyRate = Number(hall.dailyRentalPrice || (hourlyRate > 0 ? hourlyRate * 8 : 18000));
            const ongoingTx = getOngoingBookingForVenue(hall);

            return (
              <motion.div
                key={hall.id}
                whileHover={{ y: -2 }}
                className={`bg-white border ${ongoingTx ? 'border-amber-400 bg-amber-50/20' : 'border-zinc-200 hover:border-zinc-900'} p-4 sm:p-6 flex flex-col justify-between transition-all relative group shadow-xs`}
              >
                <div>
                  <div className="flex justify-between items-start gap-2">
                    {ongoingTx ? (
                      <span className="inline-flex items-center px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider border bg-red-100 text-red-900 border-red-300">
                        <AlertCircle className="h-3 w-3 mr-1 text-red-600" />
                        Occupied / Booked ({ongoingTx.transmittalNo})
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider border bg-amber-50 text-amber-900 border-amber-200">
                        Daily & Hourly Venue
                      </span>
                    )}

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-zinc-400 font-mono">
                        {hall.sku}
                      </span>
                      {currentUser?.role !== 'Front Desk' && onDeleteItem && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingHall(hall);
                          }}
                          className="text-zinc-400 hover:text-red-650 p-1 hover:bg-red-50 rounded-sm border border-transparent hover:border-red-200 transition-colors cursor-pointer"
                          title="Delete Event Venue"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <h3 className="mt-3 text-base font-black text-zinc-900 uppercase tracking-tight line-clamp-2">
                    {hall.name}
                  </h3>

                  <div className="flex items-center text-[11px] text-zinc-500 mt-1 font-semibold">
                    <MapPin className="h-3.5 w-3.5 mr-1 text-zinc-400 shrink-0" />
                    <span className="truncate">{hall.location || 'Madigun Hotel Premises'}</span>
                  </div>

                  {ongoingTx && (
                    <div className="mt-2.5 p-2 bg-red-50 border border-red-200 text-[10px] space-y-0.5 font-mono">
                      <div className="font-bold text-red-950 uppercase">
                        Current Active Booking: {ongoingTx.transmittalNo}
                      </div>
                      <div className="text-zinc-700 truncate">
                        Rentee: <span className="font-bold text-zinc-900">{ongoingTx.rentee}</span>
                      </div>
                      <div className="text-zinc-500 text-[9px]">
                        {ongoingTx.dateCheckout} ➔ {ongoingTx.dateCheckin}
                      </div>
                    </div>
                  )}

                  {/* Dual Pricing Box (Daily & Hourly) */}
                  <div className="mt-4 bg-amber-50/50 p-3 border border-amber-200/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-zinc-950 font-bold text-xs uppercase tracking-wider">
                        <Calendar className="h-3.5 w-3.5 text-amber-700" />
                        Daily Rate:
                      </span>
                      <span className="font-mono font-black text-emerald-700 text-sm">
                        ₱{dailyRate.toLocaleString()} <span className="text-[10px] text-zinc-500 font-normal">/ day</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-t border-amber-200/50 pt-1.5">
                      <span className="flex items-center gap-1.5 text-zinc-700 font-semibold text-xs uppercase tracking-wider">
                        <Clock className="h-3.5 w-3.5 text-zinc-500" />
                        Hourly Rate:
                      </span>
                      <span className="font-mono font-bold text-zinc-800 text-xs">
                        ₱{hourlyRate.toLocaleString()} <span className="text-[9px] text-zinc-500 font-normal">/ hr</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-zinc-100 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Status</span>
                    {ongoingTx ? (
                      <span className="text-xs font-bold text-red-700 uppercase tracking-wider block truncate">
                        Occupied / Active Booking
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider block">
                        Ready for Booking
                      </span>
                    )}
                  </div>

                  {currentUser?.role !== 'Managing Director' && (
                    <button
                      id={`btn-rent-venue-${hall.sku}`}
                      onClick={() => handleOpenBookModal(hall)}
                      className={`px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-white ${
                        ongoingTx ? 'bg-amber-600 hover:bg-amber-700' : 'bg-zinc-900 hover:bg-zinc-800'
                      } transition-colors cursor-pointer flex items-center shrink-0 shadow-xs`}
                    >
                      <Calendar className="h-3.5 w-3.5 mr-1.5" />
                      {ongoingTx ? 'View / Book' : 'Rent Venue'}
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Extension Modal */}
      <AnimatePresence>
        {isExtendModalOpen && selectedTxToExtend && (
          <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-zinc-200 max-w-lg w-full p-6 shadow-2xl space-y-5"
            >
              <div className="flex justify-between items-center border-b border-zinc-200 pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-600" />
                  <h2 className="text-base font-black text-zinc-900 uppercase tracking-wider">
                    Extend Venue Rental Duration
                  </h2>
                </div>
                <button
                  onClick={() => setIsExtendModalOpen(false)}
                  className="text-zinc-400 hover:text-zinc-900 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold uppercase tracking-wider flex items-center">
                  <AlertCircle className="h-4 w-4 mr-2 shrink-0" />
                  {errorMsg}
                </div>
              )}

              <div className="bg-amber-50/70 p-3.5 border border-amber-200 text-xs space-y-1">
                <div className="font-bold text-zinc-950 uppercase">
                  Transmittal: <span className="font-mono text-amber-800">{selectedTxToExtend.transmittalNo}</span>
                </div>
                <div className="font-semibold text-zinc-700">
                  Guest / Rentee: <span className="font-bold text-zinc-900">{selectedTxToExtend.rentee}</span>
                </div>
                <div className="text-[11px] text-zinc-500 font-mono">
                  Current Check-in Target Date: <span className="font-bold text-zinc-900">{selectedTxToExtend.dateCheckin}</span>
                </div>
              </div>

              {/* Extension Mode Toggle (Days vs Hours) */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                  Extension Type
                </label>
                <div className="grid grid-cols-2 p-1 bg-zinc-100 border border-zinc-200">
                  <button
                    type="button"
                    onClick={() => {
                      setExtensionMode('Days');
                      let defaultDaily = 18000;
                      for (const item of selectedTxToExtend.items) {
                        const invItem = inventory.find(i => i.id === item.itemId || i.sku === item.sku);
                        if (invItem) {
                          if (Number(invItem.dailyRentalPrice) > 0) defaultDaily = Number(invItem.dailyRentalPrice);
                          else if (Number(invItem.rentalPrice) > 0) defaultDaily = Number(invItem.rentalPrice) * 8;
                          break;
                        }
                      }
                      setExtensionRate(defaultDaily);
                    }}
                    className={`py-1.5 px-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                      extensionMode === 'Days'
                        ? 'bg-zinc-900 text-white shadow-xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    <Calendar className="h-3.5 w-3.5 text-amber-500" />
                    Extend By Days
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setExtensionMode('Hours');
                      let defaultHourly = 2500;
                      for (const item of selectedTxToExtend.items) {
                        const invItem = inventory.find(i => i.id === item.itemId || i.sku === item.sku);
                        if (invItem && Number(invItem.rentalPrice) > 0) {
                          defaultHourly = Number(invItem.rentalPrice);
                          break;
                        }
                      }
                      setExtensionRate(defaultHourly);
                    }}
                    className={`py-1.5 px-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                      extensionMode === 'Hours'
                        ? 'bg-zinc-900 text-white shadow-xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    <Clock className="h-3.5 w-3.5 text-amber-500" />
                    Extend By Hours
                  </button>
                </div>
              </div>

              <form onSubmit={handleConfirmExtension} className="space-y-4">
                {extensionMode === 'Days' ? (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-900 uppercase tracking-widest mb-1">
                        Extension Duration (Additional Days) *
                      </label>
                      <input
                        id="input-extension-days"
                        type="number"
                        min="1"
                        max="365"
                        required
                        value={extensionDays}
                        onChange={(e) => setExtensionDays(Math.max(1, Number(e.target.value)))}
                        className="w-full px-3 py-2 border border-zinc-300 font-mono font-bold text-xs bg-zinc-50 text-zinc-950"
                      />
                    </div>

                    {/* Quick Presets for Days */}
                    <div>
                      <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                        Quick Choose Days
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {[1, 2, 3, 5, 7, 14].map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setExtensionDays(d)}
                            className={`px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider border cursor-pointer transition-all ${
                              extensionDays === d
                                ? 'bg-zinc-900 text-white border-zinc-900'
                                : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                            }`}
                          >
                            +{d} Day{d > 1 ? 's' : ''}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                        Daily Extension Rate (₱ / day) *
                      </label>
                      <input
                        id="input-extension-rate-daily"
                        type="number"
                        min="0"
                        required
                        value={extensionRate}
                        onChange={(e) => setExtensionRate(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-zinc-200 font-mono font-bold text-xs bg-zinc-50 text-zinc-900"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-900 uppercase tracking-widest mb-1">
                        Extension Duration (Additional Hours) *
                      </label>
                      <input
                        id="input-extension-hours"
                        type="number"
                        min="1"
                        max="168"
                        required
                        value={extensionHours}
                        onChange={(e) => setExtensionHours(Math.max(1, Number(e.target.value)))}
                        className="w-full px-3 py-2 border border-zinc-300 font-mono font-bold text-xs bg-zinc-50 text-zinc-950"
                      />
                    </div>

                    {/* Quick Presets for Hours */}
                    <div>
                      <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                        Quick Choose Additional Hours
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {[1, 2, 3, 4, 6, 8, 12, 24].map((hrs) => (
                          <button
                            key={hrs}
                            type="button"
                            onClick={() => setExtensionHours(hrs)}
                            className={`px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider border cursor-pointer transition-all ${
                              extensionHours === hrs
                                ? 'bg-zinc-900 text-white border-zinc-900'
                                : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                            }`}
                          >
                            +{hrs} Hour{hrs > 1 ? 's' : ''}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                        Hourly Extension Rate (₱ / hour) *
                      </label>
                      <input
                        id="input-extension-rate-hourly"
                        type="number"
                        min="0"
                        required
                        value={extensionRate}
                        onChange={(e) => setExtensionRate(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-zinc-200 font-mono font-bold text-xs bg-zinc-50 text-zinc-900"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                    Extension Reason / Audit Notes
                  </label>
                  <input
                    id="input-extension-reason"
                    type="text"
                    placeholder="e.g. Guest extended event duration"
                    value={extensionReason}
                    onChange={(e) => setExtensionReason(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 text-xs font-semibold focus:outline-none focus:border-zinc-900 bg-zinc-50 text-zinc-850"
                  />
                </div>

                {/* Extension Fee Summary */}
                <div className="bg-zinc-950 text-white p-4 border border-zinc-800 space-y-1">
                  <div className="flex justify-between text-xs text-zinc-300 font-semibold">
                    <span>Extension Charge:</span>
                    <span className="font-mono">
                      {extensionMode === 'Days' 
                        ? `+${extensionDays} day(s) × ₱${extensionRate.toLocaleString()}/day`
                        : `+${extensionHours} hr(s) × ₱${extensionRate.toLocaleString()}/hr`
                      }
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-black uppercase tracking-wider text-emerald-400 border-t border-zinc-800 pt-2">
                    <span>Additional Fee Total:</span>
                    <span className="font-mono text-base text-emerald-300">
                      ₱{(extensionMode === 'Days' ? extensionDays * extensionRate : extensionHours * extensionRate).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsExtendModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-600 border border-zinc-200 hover:bg-zinc-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    id="btn-submit-extension"
                    type="submit"
                    disabled={isExtending}
                    className="px-5 py-2 text-xs font-bold uppercase tracking-widest text-zinc-950 bg-amber-400 hover:bg-amber-300 font-mono font-black border border-amber-300 cursor-pointer shadow-md disabled:opacity-50"
                  >
                    {isExtending ? 'Updating...' : 'Confirm Rental Extension'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hall Rental Booking Modal (Multi-Day & Hourly) */}
      <AnimatePresence>
        {isBookModalOpen && selectedHall && (
          <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-zinc-200 max-w-2xl w-full p-6 shadow-2xl space-y-5 my-8"
            >
              <div className="flex justify-between items-start border-b border-zinc-200 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-900 bg-amber-100 px-2 py-0.5 border border-amber-300">
                      Event Venue Booking
                    </span>
                    <span className="text-[10px] font-bold text-zinc-500 font-mono">
                      SKU: {selectedHall.sku}
                    </span>
                  </div>
                  <h2 className="text-lg font-black font-display text-zinc-900 uppercase tracking-wider mt-1">
                    Rent {selectedHall.name}
                  </h2>
                  <p className="text-xs text-zinc-500 font-mono mt-0.5">
                    Standard Rates: ₱{customDailyRate.toLocaleString()} / day • ₱{customHourlyRate.toLocaleString()} / hr
                  </p>
                </div>
                <button
                  onClick={() => setIsBookModalOpen(false)}
                  className="p-1 text-zinc-400 hover:text-zinc-900 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold uppercase tracking-wider flex items-center">
                  <AlertCircle className="h-4 w-4 mr-2 shrink-0" />
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleConfirmBooking} className="space-y-4">
                {/* Rentee & Handler Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                      Rentee / Guest Name *
                    </label>
                    <input
                      id="input-rentee-name-booking"
                      type="text"
                      required
                      placeholder="e.g. Maria Santos (Wedding Event)"
                      value={renteeName}
                      onChange={(e) => setRenteeName(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-200 text-xs font-semibold focus:outline-none focus:border-zinc-900 bg-zinc-50 focus:bg-white text-zinc-850"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                      Handler / Staff *
                    </label>
                    <input
                      id="input-handler-name-booking"
                      type="text"
                      required
                      value={handlerName}
                      onChange={(e) => setHandlerName(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-200 text-xs font-semibold focus:outline-none focus:border-zinc-900 bg-zinc-50 focus:bg-white text-zinc-850"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                    Event Venue Location *
                  </label>
                  <input
                    id="input-location-booking"
                    type="text"
                    required
                    value={eventAddress}
                    onChange={(e) => setEventAddress(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 text-xs font-semibold focus:outline-none focus:border-zinc-900 bg-zinc-50 focus:bg-white text-zinc-850"
                  />
                </div>

                {/* Duration Mode Selection: Multi-Day vs Hourly */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[10px] font-bold text-zinc-900 uppercase tracking-widest">
                      Rental Duration Mode *
                    </label>
                    <span className="text-[10px] text-zinc-500 font-semibold">
                      {durationMode === 'Days' ? 'Rent for multiple days (24h+)' : 'Rent for specific hours'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 p-1 bg-zinc-100 border border-zinc-200">
                    <button
                      id="tab-duration-days"
                      type="button"
                      onClick={() => {
                        setDurationMode('Days');
                        const parts = eventDate.split('-').map(Number);
                        const d = new Date(parts[0], parts[1] - 1, parts[2] + (rentalDays || 1));
                        const y = d.getFullYear();
                        const m = (d.getMonth() + 1).toString().padStart(2, '0');
                        const day = d.getDate().toString().padStart(2, '0');
                        setEndDate(`${y}-${m}-${day}`);
                      }}
                      className={`py-2 px-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all ${
                        durationMode === 'Days'
                          ? 'bg-zinc-900 text-white shadow-xs'
                          : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/70'
                      }`}
                    >
                      <Calendar className="h-4 w-4 text-amber-500" />
                      Rent By Days (Multi-Day)
                    </button>

                    <button
                      id="tab-duration-hours"
                      type="button"
                      onClick={() => setDurationMode('Hours')}
                      className={`py-2 px-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all ${
                        durationMode === 'Hours'
                          ? 'bg-zinc-900 text-white shadow-xs'
                          : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/70'
                      }`}
                    >
                      <Clock className="h-4 w-4 text-amber-500" />
                      Rent By Hours (Hourly)
                    </button>
                  </div>
                </div>

                {/* Duration Inputs based on Mode */}
                {durationMode === 'Days' ? (
                  <div className="space-y-3.5 p-3.5 bg-amber-50/40 border border-amber-200/80">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-amber-900 flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-amber-700" />
                        Multi-Day Booking Parameters
                      </span>
                      <span className="text-[10px] text-amber-800 font-mono font-bold bg-amber-100 px-2 py-0.5 border border-amber-300">
                        No 24-Hour Limit
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-900 uppercase tracking-widest mb-1">
                          Rental Duration (Number of Days) *
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            id="input-rental-days"
                            type="number"
                            min="1"
                            max="365"
                            required
                            value={rentalDays}
                            onChange={(e) => {
                              const val = Math.max(1, Number(e.target.value));
                              setRentalDays(val);
                              const parts = eventDate.split('-').map(Number);
                              const d = new Date(parts[0], parts[1] - 1, parts[2] + val);
                              const y = d.getFullYear();
                              const m = (d.getMonth() + 1).toString().padStart(2, '0');
                              const day = d.getDate().toString().padStart(2, '0');
                              setEndDate(`${y}-${m}-${day}`);
                            }}
                            className="w-28 px-3 py-2 border border-zinc-300 text-sm font-mono font-black focus:outline-none focus:border-zinc-900 bg-white text-zinc-950"
                          />
                          <span className="text-xs font-bold text-zinc-700 uppercase">
                            Day{rentalDays > 1 ? 's' : ''} ({rentalDays * 24} hrs)
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-zinc-900 uppercase tracking-widest mb-1 flex items-center justify-between">
                          <span>Daily Rate (₱ / day) *</span>
                          <span className="text-[9px] text-zinc-400 font-normal font-sans">Adjustable</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-xs font-mono font-bold text-zinc-400">₱</span>
                          <input
                            id="input-custom-daily-rate"
                            type="number"
                            min="0"
                            required
                            value={customDailyRate}
                            onChange={(e) => setCustomDailyRate(Number(e.target.value))}
                            className="w-full pl-7 pr-3 py-2 border border-zinc-300 text-xs font-mono font-bold focus:outline-none focus:border-zinc-900 bg-white text-zinc-950"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Quick Presets for Days */}
                    <div>
                      <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                        Quick Choose Days
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { days: 1, label: '1 Day (24h)' },
                          { days: 2, label: '2 Days' },
                          { days: 3, label: '3 Days' },
                          { days: 4, label: '4 Days' },
                          { days: 5, label: '5 Days' },
                          { days: 7, label: '7 Days (1 Wk)' },
                          { days: 10, label: '10 Days' },
                          { days: 14, label: '14 Days (2 Wks)' },
                          { days: 30, label: '30 Days (1 Mo)' }
                        ].map(({ days, label }) => (
                          <button
                            key={days}
                            type="button"
                            onClick={() => {
                              setRentalDays(days);
                              const parts = eventDate.split('-').map(Number);
                              const d = new Date(parts[0], parts[1] - 1, parts[2] + days);
                              const y = d.getFullYear();
                              const m = (d.getMonth() + 1).toString().padStart(2, '0');
                              const day = d.getDate().toString().padStart(2, '0');
                              setEndDate(`${y}-${m}-${day}`);
                            }}
                            className={`px-2.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider border cursor-pointer transition-all ${
                              rentalDays === days
                                ? 'bg-zinc-900 text-white border-zinc-900'
                                : 'bg-white text-zinc-700 border-zinc-200 hover:bg-amber-100 hover:border-amber-300'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Date Pickers & Exact Times */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-amber-200/80 pt-3">
                      <div className="space-y-2">
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-900 uppercase tracking-widest mb-1">
                            Start Date *
                          </label>
                          <input
                            id="input-start-date-days"
                            type="date"
                            required
                            value={eventDate}
                            onChange={(e) => {
                              const newStart = e.target.value;
                              setEventDate(newStart);
                              const parts = newStart.split('-').map(Number);
                              const d = new Date(parts[0], parts[1] - 1, parts[2] + (rentalDays || 1));
                              const y = d.getFullYear();
                              const m = (d.getMonth() + 1).toString().padStart(2, '0');
                              const day = d.getDate().toString().padStart(2, '0');
                              setEndDate(`${y}-${m}-${day}`);
                            }}
                            className="w-full px-3 py-2 border border-zinc-300 text-xs font-mono font-bold bg-white text-zinc-950 focus:outline-none focus:border-zinc-900"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-zinc-700 uppercase tracking-widest mb-1 flex items-center gap-1">
                            <Clock className="h-3 w-3 text-amber-700" /> Start Time (AM / PM)
                          </label>
                          <div className="flex items-center gap-1.5">
                            <select
                              id="select-start-hour-days"
                              value={startTimeHour}
                              onChange={(e) => setStartTimeHour(Number(e.target.value))}
                              className="px-2 py-1.5 border border-zinc-300 text-xs font-mono font-bold bg-white text-zinc-950"
                            >
                              {[1,2,3,4,5,6,7,8,9,10,11,12].map(h => (
                                <option key={h} value={h}>{h.toString().padStart(2, '0')}</option>
                              ))}
                            </select>
                            <span className="font-bold text-zinc-400 font-mono">:</span>
                            <select
                              id="select-start-min-days"
                              value={startTimeMinute}
                              onChange={(e) => setStartTimeMinute(e.target.value)}
                              className="px-2 py-1.5 border border-zinc-300 text-xs font-mono font-bold bg-white text-zinc-950"
                            >
                              {['00', '15', '30', '45'].map(m => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>
                            <div className="flex items-center border border-zinc-300 overflow-hidden font-mono font-bold text-xs ml-1">
                              <button
                                type="button"
                                onClick={() => setStartAmPm('AM')}
                                className={`px-2.5 py-1.5 cursor-pointer ${startAmPm === 'AM' ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-100'}`}
                              >
                                AM
                              </button>
                              <button
                                type="button"
                                onClick={() => setStartAmPm('PM')}
                                className={`px-2.5 py-1.5 cursor-pointer ${startAmPm === 'PM' ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-100'}`}
                              >
                                PM
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-900 uppercase tracking-widest mb-1 flex items-center justify-between">
                            <span>Check-in / Return Date *</span>
                            <span className="text-[9px] text-zinc-400 font-normal font-sans">Synced with days</span>
                          </label>
                          <input
                            id="input-end-date-days"
                            type="date"
                            required
                            value={endDate}
                            onChange={(e) => {
                              const newEnd = e.target.value;
                              setEndDate(newEnd);
                              const s = new Date(eventDate).getTime();
                              const en = new Date(newEnd).getTime();
                              if (!isNaN(s) && !isNaN(en) && en > s) {
                                const diff = Math.max(1, Math.round((en - s) / (1000 * 60 * 60 * 24)));
                                setRentalDays(diff);
                              }
                            }}
                            className="w-full px-3 py-2 border border-zinc-300 text-xs font-mono font-bold bg-white text-zinc-950 focus:outline-none focus:border-zinc-900"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-zinc-700 uppercase tracking-widest mb-1 flex items-center gap-1">
                            <Clock className="h-3 w-3 text-amber-700" /> Return Time (AM / PM)
                          </label>
                          <div className="flex items-center gap-1.5">
                            <select
                              id="select-end-hour-days"
                              value={endTimeHour}
                              onChange={(e) => setEndTimeHour(Number(e.target.value))}
                              className="px-2 py-1.5 border border-zinc-300 text-xs font-mono font-bold bg-white text-zinc-950"
                            >
                              {[1,2,3,4,5,6,7,8,9,10,11,12].map(h => (
                                <option key={h} value={h}>{h.toString().padStart(2, '0')}</option>
                              ))}
                            </select>
                            <span className="font-bold text-zinc-400 font-mono">:</span>
                            <select
                              id="select-end-min-days"
                              value={endTimeMinute}
                              onChange={(e) => setEndTimeMinute(e.target.value)}
                              className="px-2 py-1.5 border border-zinc-300 text-xs font-mono font-bold bg-white text-zinc-950"
                            >
                              {['00', '15', '30', '45'].map(m => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>
                            <div className="flex items-center border border-zinc-300 overflow-hidden font-mono font-bold text-xs ml-1">
                              <button
                                type="button"
                                onClick={() => setEndAmPm('AM')}
                                className={`px-2.5 py-1.5 cursor-pointer ${endAmPm === 'AM' ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-100'}`}
                              >
                                AM
                              </button>
                              <button
                                type="button"
                                onClick={() => setEndAmPm('PM')}
                                className={`px-2.5 py-1.5 cursor-pointer ${endAmPm === 'PM' ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-100'}`}
                              >
                                PM
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Hourly Duration Controls */
                  <div className="space-y-3.5 p-3.5 bg-zinc-50 border border-zinc-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-900 uppercase tracking-widest mb-1">
                          Event Date *
                        </label>
                        <input
                          id="input-event-date-hourly"
                          type="date"
                          required
                          value={eventDate}
                          onChange={(e) => setEventDate(e.target.value)}
                          className="w-full px-3 py-2 border border-zinc-300 text-xs font-mono font-bold bg-white text-zinc-950 focus:outline-none focus:border-zinc-900"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-zinc-900 uppercase tracking-widest mb-1 flex items-center gap-1">
                          <Clock className="h-3 w-3 text-amber-700" />
                          Start Time (AM / PM) *
                        </label>
                        <div className="flex items-center gap-1.5">
                          <select
                            id="select-start-hour-hourly"
                            value={startTimeHour}
                            onChange={(e) => setStartTimeHour(Number(e.target.value))}
                            className="px-2 py-1.5 border border-zinc-300 text-xs font-mono font-bold bg-white text-zinc-950"
                          >
                            {[1,2,3,4,5,6,7,8,9,10,11,12].map(h => (
                              <option key={h} value={h}>{h.toString().padStart(2, '0')}</option>
                            ))}
                          </select>
                          <span className="font-bold text-zinc-400 font-mono">:</span>
                          <select
                            id="select-start-min-hourly"
                            value={startTimeMinute}
                            onChange={(e) => setStartTimeMinute(e.target.value)}
                            className="px-2 py-1.5 border border-zinc-300 text-xs font-mono font-bold bg-white text-zinc-950"
                          >
                            {['00', '15', '30', '45'].map(m => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                          <div className="flex items-center border border-zinc-300 overflow-hidden font-mono font-bold text-xs ml-1">
                            <button
                              type="button"
                              onClick={() => setStartAmPm('AM')}
                              className={`px-2.5 py-1.5 cursor-pointer ${startAmPm === 'AM' ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-100'}`}
                            >
                              AM
                            </button>
                            <button
                              type="button"
                              onClick={() => setStartAmPm('PM')}
                              className={`px-2.5 py-1.5 cursor-pointer ${startAmPm === 'PM' ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-100'}`}
                            >
                              PM
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-900 uppercase tracking-widest mb-1 flex items-center gap-1">
                          <Clock className="h-3 w-3 text-amber-700" />
                          Rental Duration (Hours) *
                        </label>
                        <input
                          id="input-rental-hours-booking"
                          type="number"
                          min="1"
                          max="168"
                          required
                          value={rentalHours}
                          onChange={(e) => setRentalHours(Math.max(1, Number(e.target.value)))}
                          className="w-full px-3 py-2 border border-zinc-300 text-xs font-mono font-bold focus:outline-none focus:border-zinc-900 bg-white text-zinc-950"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-zinc-900 uppercase tracking-widest mb-1">
                          Hourly Rate (₱ / hr) *
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-xs font-mono font-bold text-zinc-400">₱</span>
                          <input
                            id="input-custom-hourly-rate"
                            type="number"
                            min="0"
                            required
                            value={customHourlyRate}
                            onChange={(e) => setCustomHourlyRate(Number(e.target.value))}
                            className="w-full pl-7 pr-3 py-2 border border-zinc-300 text-xs font-mono font-bold focus:outline-none focus:border-zinc-900 bg-white text-zinc-950"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Quick choose hours */}
                    <div>
                      <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                        Quick Choose Hours
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {[2, 4, 6, 8, 12, 24, 48].map((hrs) => (
                          <button
                            key={hrs}
                            type="button"
                            onClick={() => setRentalHours(hrs)}
                            className={`px-2.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider border cursor-pointer transition-all ${
                              rentalHours === hrs
                                ? 'bg-zinc-900 text-white border-zinc-900'
                                : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                            }`}
                          >
                            {hrs}h
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Schedule Summary & Conflict Check */}
                {(() => {
                  const schedule = getScheduleDetails(
                    durationMode,
                    eventDate,
                    endDate,
                    startTimeHour,
                    startTimeMinute,
                    startAmPm,
                    endTimeHour,
                    endTimeMinute,
                    endAmPm,
                    rentalDays,
                    rentalHours
                  );
                  const ongoingCollision = getOngoingBookingForVenue(selectedHall, schedule.startDateOnly, schedule.endDateOnly);

                  return (
                    <div className="space-y-3">
                      {ongoingCollision && (
                        <div className="p-3.5 bg-red-50 border border-red-300 text-red-900 text-xs font-semibold space-y-1">
                          <div className="font-bold flex items-center text-red-700 uppercase tracking-wider">
                            <AlertCircle className="h-4 w-4 mr-1.5 shrink-0" />
                            VENUE OCCUPIED DURING SELECTED PERIOD ({schedule.startDateOnly} TO {schedule.endDateOnly})
                          </div>
                          <p className="text-[11px] text-red-800">
                            This venue already has an ONGOING booking (<span className="font-mono font-bold text-red-950">{ongoingCollision.transmittalNo}</span> for <span className="font-bold">{ongoingCollision.rentee}</span>) overlapping with these dates.
                          </p>
                          <div className="text-[10px] text-red-700 font-mono">
                            Existing Booking: {ongoingCollision.dateCheckout} ➔ {ongoingCollision.dateCheckin}
                          </div>
                        </div>
                      )}

                      {/* Live Calculated Schedule Summary Box */}
                      <div className="bg-amber-50/80 p-3.5 border border-amber-300 text-xs font-mono space-y-1.5">
                        <div className="text-[10px] font-bold text-amber-900 uppercase tracking-widest flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 text-amber-700" />
                            {durationMode === 'Days' ? 'Multi-Day Rental Schedule Summary:' : 'Hourly Rental Schedule Summary:'}
                          </span>
                          <span className="bg-amber-200/80 text-amber-950 px-2 py-0.5 font-sans font-extrabold uppercase text-[9px] border border-amber-300">
                            {durationMode === 'Days' ? `${rentalDays} Day(s) (${rentalDays * 24} Hours)` : `${rentalHours} Hours`}
                          </span>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-zinc-900 font-bold border-t border-amber-200/70 pt-1.5">
                          <div>
                            <span className="text-zinc-500 font-normal">Start:</span> {schedule.startDateOnly} @ <span className="text-amber-950 bg-amber-200/70 px-1 py-0.5">{schedule.startTimeDisplay}</span>
                          </div>
                          <span className="text-zinc-400 hidden sm:inline">➔</span>
                          <div>
                            <span className="text-zinc-500 font-normal">Check-in End:</span> {schedule.endDateOnly} @ <span className="text-amber-950 bg-amber-200/70 px-1 py-0.5">{schedule.endTimeDisplay}</span>
                          </div>
                        </div>

                        <div className="text-[11px] text-emerald-800 font-bold pt-0.5">
                          Venue Subtotal: ₱{calculateHallTotal().toLocaleString()} 
                          {durationMode === 'Days' ? ` (₱${customDailyRate.toLocaleString()}/day × ${rentalDays} Day${rentalDays > 1 ? 's' : ''})` : ` (₱${customHourlyRate.toLocaleString()}/hr × ${rentalHours} hr${rentalHours > 1 ? 's' : ''})`}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Optional Extras / Corkage Fees Selection */}
                <div className="border border-zinc-200 p-3 bg-zinc-50/50 space-y-2">
                  <span className="text-xs font-bold text-zinc-800 uppercase tracking-wider block">
                    Add Extra Equipment & Corkage Fees (Optional)
                  </span>

                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {hourlyItems.map(item => {
                      const selected = extraItems.find(ei => ei.itemId === item.id);
                      const isHourly = item.isHourlyCharged;
                      const rate = Number(item.rentalPrice || 0);

                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2 bg-white border border-zinc-200 text-xs"
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <span className="font-bold text-zinc-900 block truncate">{item.name}</span>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              ₱{rate.toLocaleString()} {isHourly ? (durationMode === 'Days' ? '/ day charge' : '/ hour') : 'flat fee'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {selected ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="1"
                                  value={selected.quantity}
                                  onChange={(e) => {
                                    const qty = Number(e.target.value);
                                    if (qty <= 0) {
                                      setExtraItems(extraItems.filter(ei => ei.itemId !== item.id));
                                    } else {
                                      setExtraItems(extraItems.map(ei => ei.itemId === item.id ? { ...ei, quantity: qty } : ei));
                                    }
                                  }}
                                  className="w-14 px-2 py-1 border border-zinc-300 text-xs font-mono font-bold text-center"
                                />
                                <button
                                  type="button"
                                  onClick={() => setExtraItems(extraItems.filter(ei => ei.itemId !== item.id))}
                                  className="text-red-600 hover:text-red-800 p-1 cursor-pointer"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setExtraItems([...extraItems, { itemId: item.id, quantity: 1 }])}
                                className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 cursor-pointer"
                              >
                                + Add Fee / Item
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Additional Notes */}
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                    Booking Notes & Setup Remarks
                  </label>
                  <input
                    id="input-booking-notes"
                    type="text"
                    placeholder="e.g. Stage setup required, banquet layout"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 text-xs font-semibold focus:outline-none focus:border-zinc-900 bg-zinc-50 focus:bg-white text-zinc-850"
                  />
                </div>

                {/* Calculation Breakdown */}
                <div className="bg-zinc-950 text-white p-4 space-y-2 border border-zinc-800">
                  <div className="flex justify-between text-xs text-zinc-300 font-semibold">
                    <span>Selected Duration:</span>
                    <span className="font-mono font-bold text-amber-400">
                      {durationMode === 'Days' ? `${rentalDays} Day(s) (${rentalDays * 24} Hours)` : `${rentalHours} Hours`}
                    </span>
                  </div>

                  <div className="flex justify-between text-xs text-zinc-300 font-semibold">
                    <span>Venue Base Rate:</span>
                    <span className="font-mono">
                      {durationMode === 'Days'
                        ? `₱${customDailyRate.toLocaleString()} / day × ${rentalDays} day(s)`
                        : `₱${customHourlyRate.toLocaleString()} / hr × ${rentalHours} hr(s)`}
                    </span>
                  </div>

                  <div className="flex justify-between text-xs text-zinc-300 font-semibold">
                    <span>Venue Rental Subtotal:</span>
                    <span className="font-mono font-bold text-white">₱{calculateHallTotal().toLocaleString()}</span>
                  </div>

                  {extraItems.length > 0 && (
                    <div className="flex justify-between text-xs text-zinc-300 font-semibold border-t border-zinc-800 pt-1.5">
                      <span>Extra Equipment / Corkages:</span>
                      <span className="font-mono text-amber-300">₱{calculateExtrasTotal().toLocaleString()}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-sm font-black uppercase tracking-wider text-emerald-400 border-t border-zinc-800 pt-2">
                    <span>Grand Total Estimated Revenue:</span>
                    <span className="font-mono text-base text-emerald-300">₱{calculateGrandTotal().toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsBookModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-600 bg-white border border-zinc-200 hover:bg-zinc-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    id="btn-confirm-hall-booking"
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 text-xs font-bold uppercase tracking-widest text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 cursor-pointer flex items-center shadow-md"
                  >
                    {isSubmitting ? 'Processing...' : 'Confirm Venue Booking & Issue Transmittal'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add New Custom Venue Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-zinc-200 max-w-lg w-full p-6 shadow-2xl space-y-5"
            >
              <div className="flex justify-between items-center border-b border-zinc-200 pb-3">
                <h2 className="text-base font-black text-zinc-900 uppercase tracking-wider">
                  Add New Event Hall / Venue
                </h2>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-zinc-400 hover:text-zinc-900 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateHall} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                    Venue / Hall Name *
                  </label>
                  <input
                    id="input-venue-name"
                    type="text"
                    required
                    placeholder="e.g. Emerald Garden Pavilion"
                    value={newHallData.name}
                    onChange={(e) => setNewHallData({ ...newHallData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-200 text-xs font-semibold focus:outline-none focus:border-zinc-900 bg-zinc-50 focus:bg-white text-zinc-850"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                      SKU Code
                    </label>
                    <input
                      id="input-venue-sku"
                      type="text"
                      value={newHallData.sku}
                      onChange={(e) => setNewHallData({ ...newHallData, sku: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-200 text-xs font-mono bg-zinc-50 text-zinc-850"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-zinc-800 uppercase tracking-widest mb-1">
                      Daily Rate (₱ / day) *
                    </label>
                    <input
                      id="input-venue-daily-rate"
                      type="number"
                      required
                      min="0"
                      value={newHallData.dailyRentalPrice}
                      onChange={(e) => setNewHallData({ ...newHallData, dailyRentalPrice: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-zinc-300 font-mono font-bold text-xs bg-zinc-50 text-zinc-950"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-zinc-800 uppercase tracking-widest mb-1">
                      Hourly Rate (₱ / hr) *
                    </label>
                    <input
                      id="input-venue-rate"
                      type="number"
                      required
                      min="0"
                      value={newHallData.rentalPrice}
                      onChange={(e) => setNewHallData({ ...newHallData, rentalPrice: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-zinc-300 font-mono font-bold text-xs bg-zinc-50 text-zinc-950"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                    Location / Floor
                  </label>
                  <input
                    id="input-venue-location"
                    type="text"
                    placeholder="e.g. West Wing 2nd Floor"
                    value={newHallData.location}
                    onChange={(e) => setNewHallData({ ...newHallData, location: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-200 text-xs font-semibold focus:outline-none focus:border-zinc-900 bg-zinc-50 focus:bg-white text-zinc-850"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-600 border border-zinc-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    id="btn-save-venue"
                    type="submit"
                    className="px-5 py-2 text-xs font-bold uppercase tracking-widest text-white bg-zinc-900 hover:bg-zinc-800 cursor-pointer"
                  >
                    Save Venue
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Venue Confirmation Modal */}
      <AnimatePresence>
        {deletingHall && (
          <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-zinc-200 max-w-md w-full p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 text-red-650">
                <div className="p-2 bg-red-50 border border-red-200">
                  <Trash2 className="h-5 w-5 text-red-650" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-zinc-900">
                    Delete Event Venue Profile
                  </h3>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wide">
                    {deletingHall.name} ({deletingHall.sku})
                  </p>
                </div>
              </div>

              <p className="text-xs text-zinc-600 leading-relaxed">
                Are you sure you want to delete <strong className="text-zinc-900">{deletingHall.name}</strong>? This will permanently remove this venue profile from the system.
              </p>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingHall(null)}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-600 bg-white border border-zinc-200 hover:bg-zinc-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!deletingHall || !onDeleteItem) return;
                    try {
                      await onDeleteItem(deletingHall.id);
                      setSuccessMsg(`Event venue "${deletingHall.name}" has been deleted.`);
                      setTimeout(() => setSuccessMsg(''), 4000);
                      setDeletingHall(null);
                    } catch (err: any) {
                      setErrorMsg(err.message || 'Failed to delete event venue.');
                      setDeletingHall(null);
                    }
                  }}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-white bg-red-650 hover:bg-red-700 cursor-pointer flex items-center shadow-md"
                >
                  Confirm & Delete Venue
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
