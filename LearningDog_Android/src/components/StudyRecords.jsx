import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { NavBar, Card, List, Tag, Toast, Button, Popup } from 'antd-mobile';
import { DownlandOutline } from 'antd-mobile-icons';
import { toPng } from 'html-to-image';
import dayjs from 'dayjs';
import { apiGetDailyRecords, apiGetStats, apiGetRecords } from '../utils/api';
import { useApp } from '../App';

function formatDuration(seconds) {
  if (!seconds) return '0分钟';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}小时${m}分钟`;
  return `${m}分钟`;
}

function CalendarHeatmap({ data }) {
  const today = dayjs();
  const startDate = today.subtract(90, 'day');
  const dataMap = {};
  (data || []).forEach(d => { dataMap[d.date] = d.total_seconds; });

  const weeks = [];
  let currentDate = startDate.startOf('week');

  while (currentDate.isBefore(today) || currentDate.isSame(today, 'day')) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      const dateStr = currentDate.format('YYYY-MM-DD');
      const seconds = dataMap[dateStr] || 0;
      const intensity = seconds === 0 ? 0 : seconds < 1800 ? 1 : seconds < 3600 ? 2 : seconds < 7200 ? 3 : 4;
      const colors = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];
      week.push(
        <div
          key={dateStr}
          style={{
            width: 10, height: 10, borderRadius: 2,
            background: currentDate.isAfter(today) ? 'transparent' : colors[intensity],
          }}
        />
      );
      currentDate = currentDate.add(1, 'day');
    }
    weeks.push(
      <div key={`week-${weeks.length}`} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {week}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 2, overflowX: 'auto', padding: '8px 0' }}>
      {weeks}
    </div>
  );
}

export default function StudyRecords() {
  const navigate = useNavigate();
  const { user } = useApp();
  const [daily, setDaily] = useState([]);
  const [stats, setStats] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const posterRef = useRef(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    if (!user?.uuid) return;
    setLoading(true);
    Promise.all([
      apiGetDailyRecords(user.uuid),
      apiGetStats(user.uuid),
      apiGetRecords(user.uuid),
    ]).then(([dailyData, statsData, recordsData]) => {
      setDaily(dailyData);
      setStats(statsData);
      setRecords(recordsData);
    }).catch(() => {
      Toast.show({ content: '获取学习记录失败' });
    }).finally(() => setLoading(false));
  }, [user?.uuid]);

  const showPosterPreview = async () => {
    if (!posterRef.current) return;
    try {
      const dataUrl = await toPng(posterRef.current, { backgroundColor: '#ffffff', pixelRatio: 2 });
      setPreviewUrl(dataUrl);
      setPreviewVisible(true);
    } catch (err) {
      Toast.show({ content: err?.message || '生成海报失败' });
    }
  };

  const savePoster = async () => {
    if (!previewUrl) return;
    try {
      const link = document.createElement('a');
      link.download = `LearningDog_${user.username}_${dayjs().format('YYYY-MM-DD')}.png`;
      link.href = previewUrl;
      link.click();
      Toast.show({ content: '海报已保存' });
      setPreviewVisible(false);
    } catch (err) {
      Toast.show({ content: err?.message || '保存失败' });
    }
  };

  const todayRecord = daily.find(d => d.date === dayjs().format('YYYY-MM-DD'));

  return (
    <div className="mobile-screen mobile-screen-light">
      <NavBar onBack={() => navigate('/rooms')} right={
        <Button size="mini" onClick={showPosterPreview}>导出海报</Button>
      }>
        学习记录
      </NavBar>

      <div className="mobile-main" style={{ overflow: 'auto', padding: 12 }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <Card style={{ borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: '#999' }}>总专注时长</div>
            <div style={{ fontSize: 16, fontWeight: 'bold' }}>{stats ? formatDuration(stats.totalSeconds) : '-'}</div>
          </Card>
          <Card style={{ borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: '#999' }}>总天数</div>
            <div style={{ fontSize: 16, fontWeight: 'bold' }}>{stats?.totalDays || 0} 天</div>
          </Card>
          <Card style={{ borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: '#999' }}>平均每日</div>
            <div style={{ fontSize: 16, fontWeight: 'bold' }}>{stats ? formatDuration(stats.avgDailySeconds) : '-'}</div>
          </Card>
          <Card style={{ borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: '#999' }}>总会话数</div>
            <div style={{ fontSize: 16, fontWeight: 'bold' }}>{stats?.totalSessions || 0} 次</div>
          </Card>
        </div>

        {/* Heatmap */}
        <Card title="专注日历" style={{ borderRadius: 8, marginBottom: 12 }}>
          <CalendarHeatmap data={daily} />
        </Card>

        {/* Records */}
        <Card title="专注日志" style={{ borderRadius: 8 }}>
          <List>
            {records.slice(0, 30).map(record => (
              <List.Item
                key={record.id}
                description={record.end_time ? `结束于 ${dayjs(record.end_time).format('HH:mm')}` : '进行中'}
                extra={
                  <Tag color={record.duration_seconds ? 'success' : 'primary'}>
                    {record.duration_seconds ? formatDuration(record.duration_seconds) : '进行中'}
                  </Tag>
                }
              >
                {dayjs(record.start_time).format('MM-DD HH:mm')}
              </List.Item>
            ))}
          </List>
        </Card>
      </div>

      {/* Poster preview popup */}
      <Popup
        visible={previewVisible}
        onMaskClick={() => setPreviewVisible(false)}
        bodyStyle={{ borderTopLeftRadius: 12, borderTopRightRadius: 12, padding: 16, maxHeight: '80vh', overflow: 'auto' }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 'bold', marginBottom: 12 }}>海报预览</div>
          {previewUrl && (
            <img src={previewUrl} alt="poster" style={{ width: '100%', maxWidth: 320, borderRadius: 8 }} />
          )}
          <div style={{ marginTop: 16 }}>
            <Button
              block
              color="primary"
              onClick={savePoster}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <DownlandOutline /> 保存海报
            </Button>
          </div>
        </div>
      </Popup>

      {/* Hidden poster */}
      <div style={{ position: 'absolute', left: -9999 }}>
        <div ref={posterRef} style={{
          width: 360, padding: 24,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: '#fff', fontFamily: 'system-ui, sans-serif',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 32 }}>🐕 LearningDog</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>在线自习 · 互相监督</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>{user?.username}</div>
            <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 6 }}>📅 {dayjs().format('YYYY年MM月DD日')}</div>
            <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 6 }}>🔥 今日专注: {todayRecord ? formatDuration(todayRecord.total_seconds) : '0分钟'}</div>
            <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 6 }}>📊 累计专注: {stats ? formatDuration(stats.totalSeconds) : '0分钟'}</div>
            <div style={{ fontSize: 13, opacity: 0.9 }}>📈 平均每日: {stats ? formatDuration(stats.avgDailySeconds) : '0分钟'}</div>
          </div>
          <div style={{ textAlign: 'center', marginTop: 12, fontSize: 11, opacity: 0.6 }}>坚持学习，成为更好的自己</div>
        </div>
      </div>
    </div>
  );
}
