/*
Bug's:
- When an item was rearranged, the react dom won't update correctly after deleting it

ToDo's:
- Get rid of JSX transformer (deprecated) and use Babel instead
- Move to https://github.com/facebookincubator/create-react-app for Building
- Notification.requestPermission should use promises
- Fix Encoding issues (several browsers) on original MVC App (Delete and dropdown symbol)
- Fix Mobile version
- Switch to SASS (check if BEM is useful)
- Add testing
 */

/*jshint quotmark:false */
/*jshint white:false */
/*jshint trailing:false */
/*jshint newcap:false */
/*global React, Router*/
var app = app || {};

(function () {
	'use strict';

	app.ALL_TODOS = 'all';
	app.ACTIVE_TODOS = 'active';
	app.COMPLETED_TODOS = 'completed';
	var TodoFooter = app.TodoFooter;
	var TodoItem = app.TodoItem;

	// NEW: added Global for granted notification permission
	var displayNotes = window.Notification && Notification.permission !== 'denied' ? true : false;

	var ENTER_KEY = 13;

	var TodoApp = React.createClass({
		getInitialState: function () {
			return {
				nowShowing: app.ALL_TODOS,
				editing: null,
				newTodo: '',

				// NEW: states
				newTiming: '', 			// get timing information when dropdown is changed
				sortableList: false, 	// state of sortable list init
				newItemSaved: false		// last added item
			};
		},

		componentDidMount: function () {
			var setState = this.setState;
			var router = Router({
				'/': setState.bind(this, {nowShowing: app.ALL_TODOS}),
				'/active': setState.bind(this, {nowShowing: app.ACTIVE_TODOS}),
				'/completed': setState.bind(this, {nowShowing: app.COMPLETED_TODOS})
			});
			router.init('/');

			// NEW: sort todos according to priority
			this.props.model.todos.sort(function(a, b) {
				return parseFloat(a.prio) - parseFloat(b.prio);
			});

			// NEW: initialise timer and sortable list on mount
			this.addTimer();
			this.makeListSortable();
		},

		// NEW: handle states after rerender
		componentDidUpdate: function () {
			// if there is a new item add a timer to it
			if (this.state.newItemSaved) {
				
				var node = document.getElementById(this.state.newItemSaved.id),
					nodeTimer = node.getElementsByClassName('timer')[0];

				if( node.dataset.timer > 0 ){
					this.runTimer(nodeTimer, node.dataset.timer * 60, this.state.newItemSaved);
				}

				this.setState({newItemSaved: false});
			}

			// test for changes in sortable list
			this.makeListSortable();
		},

		// NEW: make list sortable
		makeListSortable: function() {
			var list = React.findDOMNode(this).getElementsByClassName('todo-list')[0];

			if (this.props.model.todos.length > 1 && !this.state.sortableList && list) {
			// add sortable list if there are more than two elements and it wasn't added before
			
				Sortable.create(list);
				this.setState({sortableList: true});
			
			} else if (this.props.model.todos.length === 0 && this.state.sortableList) {
			// if all elements are deleted sortableList state has to be resetted
			
				this.setState({sortableList: false});
			}
		},

		// NEW: add timers to all items on mount
		addTimer: function() {
			var todos = this.props.model.todos;
			for (var i = 0; i < todos.length; i++) {
				if( todos[i].timing > 0 ){
					var node = document.getElementById(todos[i].id),
						nodeTimer = node.getElementsByClassName('timer')[0];
					this.runTimer(nodeTimer, todos[i].timing * 60, todos[i]);
				}
			}
		},

		// NEW: run timer per iteration
		// timer will run only ones and deletes timing on item afterwards
		// if page is reloaded before end of run, the timer will start agein
		runTimer: function(node, timing, todo) {

			var timer = timing, minutes, seconds,
				that = this;

			setTimeout(function () {
				minutes = parseInt(timer / 60, 10);
				seconds = parseInt(timer % 60, 10);

				minutes = minutes < 10 ? '0' + minutes : minutes;
				seconds = seconds < 10 ? '0' + seconds : seconds;

				node.textContent = minutes + ':' + seconds;

			    if (--timer > 0) {
					that.runTimer(node, timing - 1, todo);
				} else {
				// do if timer run is finished
				
					that.notifyUser(todo.title);
					that.deleteTimer(todo);
					node.textContent = 'Do it!'
				} 

			}, 1000);
		},

		// NEW: notification on timers end
		notifyUser: function( text ) {
			if (displayNotes) {
			// if permission to show notification was granted
			
				Notification.requestPermission( function (status) {  
					var n = new Notification('Now Due:', { 
						body: text,
	  					icon: 'icons/alarm.png'
					}); 
				});
			} else {
			// you don't wan't to see a notification but you get one anyway
			
				alert ( 'Now due: ' + text );
			}

			// play embeded sound, as audio on notification
			// is not supported in any browser now
			document.getElementById('sound').play();
		},

		// NEW: handler for the reminder dropdown
		handleChangeDropdown: function (event) {
			this.setState({newTiming: event.target.value});
		},

		// NEW: handler for the drop event
		handleDrop: function (event) {
			var model = this.props.model.todos,
				nodes = event.currentTarget.getElementsByTagName('li'), // ul
				that = this;

			// run trough all dom li nodes
			// update model node with the same id
			for (var i = 0; i < nodes.length; i++) {
				var id = nodes[i].getAttribute('id');
				model.filter(function (candidate) {
					if (candidate.id === id) {
						that.updatePrio(candidate, i + 1);
					}
				});
			}
		},

		// NEW: handler for the button click used for saving a new todo
		handleNewTodoButtonClick: function (event) {
			var val = this.state.newTodo.trim(),
				timing = this.state.newTiming;

			if (val) {
				var todo = this.props.model.addTodo(val, timing);
				this.setState({newTodo: '', newTiming: '', newItemSaved: todo});
			}
		},

		handleNewTodoKeyDown: function (event) {
			if (event.keyCode !== ENTER_KEY) {
				return;
			}

			event.preventDefault();

			// NEW: maps to the button click handler to save an item
			this.handleNewTodoButtonClick();
		},

		handleChange: function (event) {
			this.setState({newTodo: event.target.value});
		},

		toggleAll: function (event) {
			var checked = event.target.checked;
			this.props.model.toggleAll(checked);
		},

		toggle: function (todoToToggle) {
			this.props.model.toggle(todoToToggle);
		},

		destroy: function (todo) {
			this.props.model.destroy(todo);
		},

		edit: function (todo) {
			this.setState({editing: todo.id});
		},

		// NEW: as there are several properties of an item that can be updated now
		// the todoToSave object is modified before being passed to the model
		// this way the following functions can all use this.props.model.save
		save: function (todoToSave, text) {
			todoToSave.title = text;
			this.props.model.save(todoToSave);
			this.setState({editing: null});
		},

		// NEW: update priority
		updatePrio: function (todoToSave, prio) {
			todoToSave.prio = prio;
			this.props.model.save(todoToSave);
		},

		// NEW: deletes timing after timer run has finished
		deleteTimer: function (todoToSave) {
			todoToSave.timing = 0
			this.props.model.save(todoToSave);
		},

		cancel: function () {
			this.setState({editing: null});
		},

		clearCompleted: function () {
			this.props.model.clearCompleted();
		},

		render: function () {
			var footer;
			var main;
			var todos = this.props.model.todos;

			var shownTodos = todos.filter(function (todo) {
				switch (this.state.nowShowing) {
				case app.ACTIVE_TODOS:
					return !todo.completed;
				case app.COMPLETED_TODOS:
					return todo.completed;
				default:
					return true;
				}
			}, this);

			var todoItems = shownTodos.map(function (todo) {
				return (
					<TodoItem
						key={todo.id}
						todo={todo}
						onToggle={this.toggle.bind(this, todo)}
						onDestroy={this.destroy.bind(this, todo)}
						onEdit={this.edit.bind(this, todo)}
						editing={this.state.editing === todo.id}
						onSave={this.save.bind(this, todo)}
						onCancel={this.cancel}/>
				);
			}, this);

			var activeTodoCount = todos.reduce(function (accum, todo) {
				return todo.completed ? accum : accum + 1;
			}, 0);

			var completedCount = todos.length - activeTodoCount;

			if (activeTodoCount || completedCount) {
				footer =
					<TodoFooter
						count={activeTodoCount}
						completedCount={completedCount}
						nowShowing={this.state.nowShowing}
						onClearCompleted={this.clearCompleted}/>;
			}

			// NEW: added drop handler to list
			if (todos.length) {
				main = (
					<section className="main">
						<input
							className="toggle-all"
							type="checkbox"
							onChange={this.toggleAll}
							checked={activeTodoCount === 0}/>
						<ul className="todo-list" onDrop={this.handleDrop}>
							{todoItems}
						</ul>
					</section>
				);
			}

			// NEW: added a new select and button to add timing
			return (
				<div>
					<header className="header">
						<h1>todos</h1>
						<input
							className="new-todo"
							placeholder="What needs to be done?"
							value={this.state.newTodo}
							onKeyDown={this.handleNewTodoKeyDown}
							onChange={this.handleChange}
							autoFocus={true}/>
						<span className="submit-bar">
							<select 
								className="form-control"
								onChange={this.handleChangeDropdown}
								value={this.state.newTiming}>
								<option value="">No Reminder</option>
								<option value="1">1 Minute</option>
								<option value="5">5 Minutes</option>
								<option value="10">10 Minutes</option>
							</select>
							<button 
								type="button"
								className="btn btn-default"
								onClick={this.handleNewTodoButtonClick}>
									Add
							</button>
						</span>
					</header>
					{main}
					{footer}
				</div>
			);
		}
	});

	var model = new app.TodoModel('react-todos');

	function render () {
		React.render(
			<TodoApp model={model}/>,
			document.getElementsByClassName('todoapp')[0]
		);
	}

	model.subscribe(render);
	render();
	
})();
